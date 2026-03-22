import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@hermes/env";
import {
  prisma as orchestrationPrisma,
  type Prisma,
} from "@hermes/orchestration-database";
import { substituteVariables } from "@hermes/scheduler";
import got from "got";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { fetchAllTickersForPipelineRun } from "@/lib/domain-dashboard";
import { validatePipeline } from "@/lib/validate-pipeline";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  tickersRun: z.number(),
});

const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z.string(),
});

/**
 * Builds a short human-readable detail from an agent error response body (JSON object or string).
 *
 * @param body - Parsed or raw body from `got` when `throwHttpErrors` is false.
 * @returns Message for dashboard users (agent `message` field when present).
 */
export const detailFromAgentErrorBody = (body: unknown): string => {
  if (body === null || body === undefined) {
    return "Unknown error (empty response body)";
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return "Unknown error (empty response body)";
    try {
      const parsed = JSON.parse(trimmed) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      /* not JSON */
    }
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return "Unknown error (see agent logs)";
};

const defaultGetToken =
  env.AGENT_AUTH_API_URL && env.HERMES_INTERNAL_API_KEY
    ? createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.HERMES_INTERNAL_API_KEY,
      }).getToken
    : null;

type RunPipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  /** Orchestration DB (pipelines, steps, agent registry). */
  db?: typeof orchestrationPrisma;
  /** Loads ticker ids via domain HTTP API (no direct Mediapulse DB). */
  fetchTickersForPipelineRun?: () => Promise<Array<{ id: string }>>;
  /** Returns a short-lived JWT for agent invocation. */
  getToken?: () => Promise<string>;
  post?: typeof got.post;
};

type RunPipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the run-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession, orchestration db, ticker fetch, getToken, and post (got.post).
 * @returns Handler that runs the pipeline for all tickers (each ticker gets all steps in order).
 *          Each agent POST body matches `createAgentApp`: `{ input, config }` with `tickerId` merged into `input`.
 */
export const createRunPipelineHandler = ({
  getSession = getDashboardSession,
  db = orchestrationPrisma,
  fetchTickersForPipelineRun = fetchAllTickersForPipelineRun,
  getToken = defaultGetToken ??
    (async () => {
      throw new Error(
        "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required",
      );
    }),
  post = got.post,
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    let jwt: string;
    try {
      jwt = await getToken();
    } catch (err) {
      console.error("--> error getting token", err);
      return errorResponse(
        "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required to run pipelines (JWT-only invocation)",
      );
    }

    const pipeline = await db.pipeline.findUnique({
      where: { id: data.body.pipelineId },
    });
    if (!pipeline) {
      return errorResponse("Pipeline not found");
    }

    const pipelineStepFindArgs = {
      where: { pipelineId: data.body.pipelineId },
      orderBy: { order: "asc" as const },
      include: { agentConfig: true },
    } satisfies Prisma.PipelineStepFindManyArgs;

    const [pipelineSteps, tickers, variables] = await Promise.all([
      db.pipelineStep.findMany(pipelineStepFindArgs),
      fetchTickersForPipelineRun(),
      db.variable.findMany(),
    ]);
    const variableMap = new Map(variables.map((v) => [v.key, v.value]));
    const pipelineValidation = await validatePipeline(
      {
        id: pipeline.id,
        name: pipeline.name,
        domainIntegrationId: pipeline.domainIntegrationId,
        steps: pipelineSteps.map((step) => ({
          id: step.id,
          order: step.order,
          agentId: step.agentId,
          agentVersion: step.agentVersion,
          agentConfigId: step.agentConfigId,
          input: step.input,
          config: step.config,
        })),
      },
      db,
    );
    if (!pipelineValidation.valid) {
      return errorResponse(
        `Pipeline is invalid: ${pipelineValidation.warnings.join("; ")}`,
      );
    }

    if (tickers.length === 0) {
      return successResponse({ ok: true as const, tickersRun: 0 });
    }

    const agentIds = pipelineSteps.map((step) => step.agentId);
    const agents = await db.agentRegistry.findMany({
      where: {
        agentId: { in: agentIds },
        domainIntegrationId: pipeline.domainIntegrationId,
      },
    });
    const agentByKey = new Map(
      agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
    );

    for (const ticker of tickers) {
      for (const step of pipelineSteps) {
        const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
        if (!agent) continue;
        const endpoint = await AgentEndpointSchema.parseAsync(agent.endpoint);

        const rawInput =
          step.input != null &&
          typeof step.input === "object" &&
          !Array.isArray(step.input)
            ? (step.input as Record<string, unknown>)
            : {};
        const inputSubstituted = substituteVariables(
          rawInput,
          variableMap,
        ) as Record<string, unknown>;
        const mergedInput: Record<string, unknown> = {
          ...inputSubstituted,
          tickerId: ticker.id,
        };

        let stepConfig: Record<string, unknown>;
        if (step.agentConfigId != null && step.agentConfig != null) {
          const referencedConfig = step.agentConfig.config;
          const configObj =
            referencedConfig != null &&
            typeof referencedConfig === "object" &&
            !Array.isArray(referencedConfig)
              ? (referencedConfig as Record<string, unknown>)
              : {};
          stepConfig = configObj;
        } else {
          stepConfig =
            step.config != null &&
            typeof step.config === "object" &&
            !Array.isArray(step.config)
              ? (step.config as Record<string, unknown>)
              : {};
        }
        stepConfig = substituteVariables(stepConfig, variableMap) as Record<
          string,
          unknown
        >;

        const agentResponse = await post(endpoint.url, {
          json: { input: mergedInput, config: stepConfig },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          throwHttpErrors: false,
        });
        const res = agentResponse as {
          ok?: boolean;
          statusCode?: number;
          body?: unknown;
        };
        if (res.ok !== true) {
          const detail = detailFromAgentErrorBody(res.body);
          const code = res.statusCode ?? "unknown";
          return errorResponse(
            `Ticker ${ticker.id} — ${step.agentId}@${step.agentVersion}: ${detail} (HTTP ${code})`,
          );
        }
      }
    }

    return successResponse({
      ok: true as const,
      tickersRun: tickers.length,
    });
  };
};

/**
 * Handles run pipeline: validates session and runs pipeline for all tickers (steps in order per ticker).
 */
export const handler: RunPipelineHandler = createRunPipelineHandler();

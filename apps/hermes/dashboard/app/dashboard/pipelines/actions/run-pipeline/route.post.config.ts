import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@hermes/env";
import { prisma as mediapulsePrisma } from "@workspace/mediapulse-database";
import { prisma as orchestrationPrisma } from "@workspace/orchestration-database";
import got from "got";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
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

const defaultGetToken =
  env.AGENT_AUTH_API_URL && env.AGENT_API_KEY
    ? createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.AGENT_API_KEY,
      }).getToken
    : null;

type RunPipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  /** Orchestration DB (pipelines, steps, agent registry). */
  db?: typeof orchestrationPrisma;
  /** Mediapulse domain DB (tickers). */
  mediapulseDb?: typeof mediapulsePrisma;
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
 * @param dependencies - Optional getSession, orchestration db, mediapulse db, getToken, and post (got.post).
 * @returns Handler that runs the pipeline for all tickers (each ticker gets all steps in order).
 */
export const createRunPipelineHandler = ({
  getSession = getDashboardSession,
  db = orchestrationPrisma,
  mediapulseDb = mediapulsePrisma,
  getToken = defaultGetToken ??
    (async () => {
      throw new Error("AGENT_AUTH_API_URL and AGENT_API_KEY are required");
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
        "AGENT_AUTH_API_URL and AGENT_API_KEY are required to run pipelines (JWT-only invocation)",
      );
    }

    const pipeline = await db.pipeline.findUnique({
      where: { id: data.body.pipelineId },
    });
    if (!pipeline) {
      return errorResponse("Pipeline not found");
    }

    const [pipelineSteps, tickers] = await Promise.all([
      db.pipelineStep.findMany({
        where: { pipelineId: data.body.pipelineId },
        orderBy: { order: "asc" },
      }),
      mediapulseDb.ticker.findMany(),
    ]);
    const pipelineValidation = await validatePipeline(
      {
        id: pipeline.id,
        name: pipeline.name,
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
      where: { agentId: { in: agentIds } },
    });
    const agentById = new Map(agents.map((a) => [a.agentId, a]));

    for (const ticker of tickers) {
      for (const step of pipelineSteps) {
        const agent = agentById.get(step.agentId);
        if (!agent) continue;
        const endpoint = await AgentEndpointSchema.parseAsync(agent.endpoint);
        await post(endpoint.url, {
          json: { tickerId: ticker.id },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
        });
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

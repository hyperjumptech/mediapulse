import { env } from "@workspace/env";
import { prisma } from "@workspace/database";
import got from "got";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";

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

type RunPipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  db?: typeof prisma;
  apiKey?: string;
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
 * @param dependencies - Optional getSession, db, apiKey, and post (got.post).
 * @returns Handler that runs the pipeline for all tickers (each ticker gets all steps in order).
 */
export const createRunPipelineHandler = ({
  getSession = getDashboardSession,
  db = prisma,
  apiKey = env.AGENT_API_KEY,
  post = got.post,
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    if (!apiKey) {
      return errorResponse("AGENT_API_KEY is not configured");
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
      db.ticker.findMany(),
    ]);

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
            Authorization: `Bearer ${apiKey}`,
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

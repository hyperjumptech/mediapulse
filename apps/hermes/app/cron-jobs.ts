import cron from "node-cron";
import got from "got";
import { env } from "@workspace/env";
import { prisma } from "@workspace/database";
import { logger } from "@workspace/logger";
import { z } from "zod";

const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z.string(),
});

async function runPipeline() {
  logger.info("Starting pipeline execution...");

  const [pipelines, tickers] = await Promise.all([
    prisma.pipeline.findMany({ where: { isActive: true } }),
    prisma.ticker.findMany(),
  ]);

  if (pipelines.length === 0) {
    logger.info("No active pipelines found. Skipping.");
    return;
  }
  if (tickers.length === 0) {
    logger.info("No tickers found. Skipping.");
    return;
  }

  const pipelinesWithSteps = await Promise.all(
    pipelines.map(async (pipeline) => {
      const steps = await prisma.pipelineStep.findMany({
        where: { pipelineId: pipeline.id },
        orderBy: { order: "asc" },
      });
      return { pipeline, steps };
    }),
  );

  const allAgentIds = [
    ...new Set(
      pipelinesWithSteps.flatMap(({ steps }) => steps.map((s) => s.agentId)),
    ),
  ];
  const agents = await prisma.agentRegistry.findMany({
    where: { agentId: { in: allAgentIds } },
  });
  const agentById = new Map(agents.map((a) => [a.agentId, a]));

  for (const ticker of tickers) {
    logger.info(
      { tickerSymbol: ticker.symbol },
      "Running all pipelines for ticker...",
    );

    for (const { steps } of pipelinesWithSteps) {
      for (const step of steps) {
        const agent = agentById.get(step.agentId);
        if (!agent) {
          logger.warn(
            { agentId: step.agentId, order: step.order },
            "Agent not found in registry, skipping step",
          );
          continue;
        }
        const endpoint = await AgentEndpointSchema.parseAsync(agent.endpoint);
        await got.post(endpoint.url, {
          json: { tickerId: ticker.id },
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.AGENT_API_KEY}`,
          },
        });
      }
    }

    logger.info(
      { tickerSymbol: ticker.symbol },
      "Completed all pipelines for ticker.",
    );
  }

  logger.info("Pipeline execution finished.");
}

export function initCronJobs() {
  logger.info("Initializing cron jobs in Hermes...");

  // Schedule every day at 13:00 WIB (Jakarta, UTC+7), which is 06:00 UTC
  cron.schedule("0 6 * * *", () => {
    runPipeline().catch((error) => {
      logger.error({ err: error }, "Cron pipeline execution failed");
    });
  });

  logger.info("Cron job 'Pipeline' scheduled for 13:00 WIB (06:00 UTC) daily");
}

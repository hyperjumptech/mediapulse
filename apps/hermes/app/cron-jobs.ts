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

  const pipelines = await prisma.pipeline.findMany({
    where: { isActive: true },
  });

  if (pipelines.length === 0) {
    logger.info("No active pipelines found. Skipping.");
    return;
  }

  const tickers = await prisma.ticker.findMany();

  if (tickers.length === 0) {
    logger.info("No tickers found. Skipping.");
    return;
  }

  for (const pipeline of pipelines) {
    const pipelineSteps = await prisma.pipelineStep.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: "asc" },
    });

    const agentIds = pipelineSteps.map((step) => step.agentId);

    const agents = await prisma.agentRegistry.findMany({
      where: { agentId: { in: agentIds } },
    });
    const agentById = new Map(agents.map((a) => [a.agentId, a]));

    for (const ticker of tickers) {
      logger.info(
        { pipelineName: pipeline.name, tickerSymbol: ticker.symbol },
        "Running pipeline for ticker...",
      );

      for (const step of pipelineSteps) {
        const agent = agentById.get(step.agentId);
        if (!agent) {
          console.warn(
            `Agent ${step.agentId} not found in registry, skipping step order ${step.order}`,
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

      logger.info(
        { pipelineName: pipeline.name, tickerSymbol: ticker.symbol },
        "Pipeline completed for ticker.",
      );
    }
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

  logger.info(
    "Cron job 'Pipeline' scheduled for 13:00 WIB (06:00 UTC) daily",
  );
}

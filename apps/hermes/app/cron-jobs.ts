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
  logger.info(`${new Date().toISOString()}: Starting pipeline execution...`);

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

    for (const ticker of tickers) {
      logger.info(
        `Running pipeline "${pipeline.name}" for ticker "${ticker.symbol}"...`,
      );

      await Promise.all(
        agents.map(async (agent) => {
          const endpoint = await AgentEndpointSchema.parseAsync(
            agent.endpoint,
          );

          await got.post(endpoint.url, {
            json: { tickerId: ticker.id },
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.AGENT_API_KEY}`,
            },
          });
        }),
      );

      logger.info(
        `Pipeline "${pipeline.name}" completed for ticker "${ticker.symbol}".`,
      );
    }
  }

  logger.info(`${new Date().toISOString()}: Pipeline execution finished.`);
}

export function initCronJobs() {
  logger.info("Initializing cron jobs in Hermes...");

  // Schedule every day at 11:00 AM Jakarta time (UTC+7), which is 4:00 AM UTC
  cron.schedule("0 4 * * *", () => {
    runPipeline().catch((error) => {
      logger.error({ err: error }, "Cron pipeline execution failed");
    });
  });

  logger.info(
    "Cron job 'Pipeline' scheduled for 11:00 AM Jakarta time (4:00 AM UTC) daily",
  );
}

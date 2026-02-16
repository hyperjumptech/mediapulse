import cron from "node-cron";
import { env } from "@workspace/env";
import { prisma } from "@workspace/prisma";
import { z } from "zod";

const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z.string(),
});

async function runPipeline() {
  console.log(`${new Date().toISOString()}: Starting pipeline execution...`);

  const pipelines = await prisma.pipeline.findMany({
    where: { isActive: true },
  });

  if (pipelines.length === 0) {
    console.log("No active pipelines found. Skipping.");
    return;
  }

  const tickers = await prisma.ticker.findMany();

  if (tickers.length === 0) {
    console.log("No tickers found. Skipping.");
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
      console.log(
        `Running pipeline "${pipeline.name}" for ticker "${ticker.symbol}"...`,
      );

      try {
        const responses = await Promise.all(
          agents.map(async (agent) => {
            const endpoint = await AgentEndpointSchema.parseAsync(
              agent.endpoint,
            );

            const response = await fetch(endpoint.url, {
              method: endpoint.method,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.AGENT_API_KEY}`,
              },
              body: JSON.stringify({ tickerId: ticker.id }),
            });

            if (!response.ok) {
              const body = await response.text().catch(() => "");
              throw new Error(
                `Agent "${agent.agentId}" returned ${response.status}: ${body}`,
              );
            }

            return response;
          }),
        );

        console.log(
          `Pipeline "${pipeline.name}" completed for ticker "${ticker.symbol}".`,
        );
      } catch (error) {
        console.error(
          `Pipeline "${pipeline.name}" failed for ticker "${ticker.symbol}":`,
          error,
        );
      }
    }
  }

  console.log(`${new Date().toISOString()}: Pipeline execution finished.`);
}

export function initCronJobs() {
  console.log("Initializing cron jobs in Hermes...");

  // Schedule every day at 11:00 AM Jakarta time (UTC+7), which is 4:00 AM UTC
  cron.schedule("0 4 * * *", () => {
    runPipeline().catch((error) => {
      console.error("Cron pipeline execution failed:", error);
    });
  });

  console.log(
    "Cron job 'Pipeline' scheduled for 11:00 AM Jakarta time (4:00 AM UTC) daily",
  );
}

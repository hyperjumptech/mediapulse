import { env } from "@workspace/env";
import { prisma } from "@workspace/database";
import { logger } from "@workspace/logger";
import got from "got";

import { NextResponse } from "next/server";
import { z } from "zod";

function checkAuth(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.split(" ")[1];

  if (!base64Credentials) {
    return false;
  }

  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(":");

  return (
    username === env.TEMP_ADMIN_USERNAME && password === env.TEMP_ADMIN_PASSWORD
  );
}

const BodySchema = z.object({
  pipelineId: z.string().uuid(),
  apiKey: z.string(),
});

const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z.string(),
});

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      },
    );
  }

  try {
    const body = await request.json();
    const data = await BodySchema.parseAsync(body);

    const pipeline = await prisma.pipeline.findUnique({
      where: { id: data.pipelineId },
    });
    if (!pipeline) {
      return NextResponse.json(
        { error: `Pipeline ${data.pipelineId} not found` },
        { status: 404 },
      );
    }

    const [pipelineSteps, tickers] = await Promise.all([
      prisma.pipelineStep.findMany({
        where: { pipelineId: data.pipelineId },
        orderBy: { order: "asc" },
      }),
      prisma.ticker.findMany(),
    ]);

    if (tickers.length === 0) {
      logger.info("No tickers found. Skipping.");
      return NextResponse.json({ success: true, tickersRun: 0 });
    }

    const agentIds = pipelineSteps.map((step) => step.agentId);
    const agents = await prisma.agentRegistry.findMany({
      where: { agentId: { in: agentIds } },
    });
    const agentById = new Map(agents.map((a) => [a.agentId, a]));

    for (const ticker of tickers) {
      logger.info(
        { pipelineName: pipeline.name, tickerSymbol: ticker.symbol },
        "Running pipeline for ticker (all steps in order)...",
      );

      for (const step of pipelineSteps) {
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
            Authorization: `Bearer ${data.apiKey}`,
          },
        });
      }

      logger.info(
        { pipelineName: pipeline.name, tickerSymbol: ticker.symbol },
        "Pipeline completed for ticker.",
      );
    }

    logger.info(
      { pipelineId: data.pipelineId, tickersRun: tickers.length },
      "Pipeline execution finished.",
    );
    return NextResponse.json({ success: true, tickersRun: tickers.length });
  } catch (error) {
    logger.error({ err: error }, "Error in POST handler");

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

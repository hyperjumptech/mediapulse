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
  tickerId: z.string().uuid(),
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

    const pipelineSteps = await prisma.pipelineStep.findMany({
      where: {
        pipelineId: data.pipelineId,
      },
      orderBy: { order: "asc" },
    });

    logger.info(
      { pipelineId: data.pipelineId, stepCount: pipelineSteps.length },
      "PIPELINE STEPS",
    );

    const agentIds = pipelineSteps.map((step) => step.agentId);

    const agents = await prisma.agentRegistry.findMany({
      where: { agentId: { in: agentIds } },
    });
    const agentById = new Map(agents.map((a) => [a.agentId, a]));

    logger.info({ agentIds }, "AGENTS");

    for (const step of pipelineSteps) {
      const agent = agentById.get(step.agentId);
      if (!agent) {
        throw new Error(`Agent ${step.agentId} not found in registry for step order ${step.order}`);
      }
      const endpoint = await AgentEndpointSchema.parseAsync(agent.endpoint);
      await got.post(endpoint.url, {
        json: { tickerId: data.tickerId },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.apiKey}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error in POST handler");

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { prisma } from "@hermes/orchestration-database";

import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/pipelines/[pipelineId]/schemas
 * Returns inputSchema and configSchema for each step's agent. Requires dashboard session or MCP API key.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ pipelineId: string }> },
) {
  const auth = await resolveDashboardPrincipalOrUnauthorized(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { pipelineId } = await context.params;
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const seen = new Set<string>();
  const orConditions: { agentId: string; agentVersion: string }[] = [];
  for (const s of pipeline.steps) {
    const key = `${s.agentId}\0${s.agentVersion}`;
    if (!seen.has(key)) {
      seen.add(key);
      orConditions.push({ agentId: s.agentId, agentVersion: s.agentVersion });
    }
  }

  const agents = await prisma.agentRegistry.findMany({
    where: { OR: orConditions, isActive: true },
    select: {
      agentId: true,
      agentVersion: true,
      inputSchema: true,
      configSchema: true,
    },
  });
  const agentByKey = new Map(
    agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
  );

  const steps = pipeline.steps.map((step) => {
    const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
    return {
      agentId: step.agentId,
      agentVersion: step.agentVersion,
      inputSchema: agent?.inputSchema ?? null,
      configSchema: agent?.configSchema ?? null,
    };
  });

  return NextResponse.json({ steps });
}

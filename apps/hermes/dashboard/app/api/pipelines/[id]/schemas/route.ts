import { NextResponse } from "next/server";

import { prisma } from "@workspace/orchestration-database";

import { getDashboardSession } from "@/lib/auth-dashboard";

/**
 * GET /api/pipelines/[id]/schemas
 * Returns inputSchema and configSchema for each step's agent. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pipelineId } = await context.params;
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

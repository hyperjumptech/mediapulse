import { NextResponse } from "next/server";

import { prisma } from "@hermes/orchestration-database";

import { getDashboardSession } from "@/lib/auth-dashboard";

/**
 * GET /api/agents/[agentId]/[agentVersion]/schemas
 * Returns inputSchema and configSchema from the agent registry. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ agentId: string; agentVersion: string }> },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, agentVersion } = await context.params;
  const agent = await prisma.agentRegistry.findFirst({
    where: { agentId, agentVersion, isActive: true },
    select: { inputSchema: true, configSchema: true },
  });

  if (!agent) {
    return NextResponse.json(
      { error: `Agent ${agentId}@${agentVersion} not found` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    inputSchema: agent.inputSchema,
    configSchema: agent.configSchema ?? null,
  });
}

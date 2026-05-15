import { NextResponse } from "next/server";

import { prisma } from "@hermes/orchestration-database";

import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/agents/[agentId]/[agentVersion]/schemas
 * Returns inputSchema and configSchema from the agent registry. Requires dashboard session or MCP API key.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string; agentVersion: string }> },
) {
  const auth = await resolveDashboardPrincipalOrUnauthorized(request);
  if (auth instanceof NextResponse) {
    return auth;
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

/** @vitest-environment node */
import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    agentRegistry: { findFirst: vi.fn() },
  },
}));

import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { GET as getAgentSchemas } from "@/app/api/agents/[agentId]/[agentVersion]/schemas/route";
import { prisma } from "@hermes/orchestration-database";

describe("Phase A routes accept API key principal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when principal resolution fails", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await getAgentSchemas(
      new Request("http://localhost/api/agents/a/1/schemas"),
      { params: Promise.resolve({ agentId: "a", agentVersion: "1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for read-only api_key principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "key-1",
      readOnly: true,
      label: "ro",
    });
    vi.mocked(prisma.agentRegistry.findFirst).mockResolvedValue({
      inputSchema: {},
      configSchema: null,
    } as never);

    const res = await getAgentSchemas(
      new Request("http://localhost/api/agents/a/1/schemas", {
        headers: { Authorization: "Bearer hmcp_x_y" },
      }),
      { params: Promise.resolve({ agentId: "a", agentVersion: "1" }) },
    );
    expect(res.status).toBe(200);
  });
});

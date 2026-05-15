/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  getAgentsPage: vi.fn(),
}));

import { GET } from "./route";
import { getAgentsPage } from "@/lib/agents";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { NextResponse } from "next/server";

const principal = {
  authMethod: "api_key" as const,
  user: {
    id: "u1",
    name: "Admin",
    email: "admin@test.com",
    credentialVersion: 0,
  },
  apiKeyId: "key-1",
  readOnly: false,
  label: "Cursor",
};

describe("GET /api/agents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    // Setup
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    // Act
    const res = await GET(new Request("http://localhost/api/agents"));

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns empty list", async () => {
    // Setup
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getAgentsPage).mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    // Act
    const res = await GET(
      new Request("http://localhost/api/agents", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );

    // Assert
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns paginated agents for api key principal", async () => {
    // Setup
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getAgentsPage).mockResolvedValue({
      agents: [
        {
          id: "agent-1",
          agentId: "summarizer",
          agentVersion: "1",
          domainIntegration: { integrationId: "mediapulse" },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    // Act
    const res = await GET(
      new Request("http://localhost/api/agents?page=1&pageSize=20", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );

    // Assert
    expect(getAgentsPage).toHaveBeenCalledWith(1, 20);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

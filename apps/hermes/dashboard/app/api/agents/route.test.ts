/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/agents", () => ({
  getAgentRegistryPage: vi.fn(),
}));

import { GET } from "./route";
import type { AgentRegistryPageResult } from "@/lib/agents";
import { getAgentRegistryPage } from "@/lib/agents";
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

const listPrincipal = {
  authMethod: "api_key" as const,
  user: {
    id: "u1",
    name: "Admin",
    email: "admin@test.com",
    credentialVersion: 0,
  },
  apiKeyId: "key-1",
  readOnly: true,
  label: "Agent",
};

describe("GET /api/agents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(new Request("http://localhost/api/agents"));

    expect(res.status).toBe(401);
  });

  it("returns empty list", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getAgentRegistryPage).mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(
      new Request("http://localhost/api/agents", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("returns paginated agents for api key principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getAgentRegistryPage).mockResolvedValue({
      agents: [
        {
          id: "agent-1",
          agentId: "summarizer",
          agentVersion: "1",
          description: null,
          endpoint: {},
          inputSchema: null,
          configSchema: null,
          isActive: true,
          domainIntegrationId: "di-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          domainIntegration: {
            integrationId: "mediapulse",
            name: "Mediapulse",
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } satisfies AgentRegistryPageResult);

    const res = await GET(
      new Request("http://localhost/api/agents?page=1&pageSize=20", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );

    expect(getAgentRegistryPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "agentId",
      sortDir: "asc",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getAgentRegistryPage).mockResolvedValue({
      agents: [],
      total: 25,
      page: 2,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/agents?page=2&pageSize=10&q=summar&sort=updated&dir=desc",
      ),
    );

    expect(getAgentRegistryPage).toHaveBeenCalledWith(2, 10, {
      search: "summar",
      sortBy: "updated",
      sortDir: "desc",
    });
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 25,
      page: 2,
      pageSize: 10,
      hasMore: true,
    });
  });

  it("falls back to the default sort for unknown sort fields", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getAgentRegistryPage).mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(new Request("http://localhost/api/agents?sort=secret"));

    expect(getAgentRegistryPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "agentId",
      sortDir: "asc",
    });
  });
});

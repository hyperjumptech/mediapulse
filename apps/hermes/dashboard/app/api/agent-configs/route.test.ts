/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/agent-configs", () => ({
  getAgentConfigsPage: vi.fn(),
}));

import { GET } from "./route";
import type { AgentConfigsPageResult } from "@/lib/agent-configs";
import { getAgentConfigsPage } from "@/lib/agent-configs";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

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

describe("GET /api/agent-configs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new Request("http://localhost/api/agent-configs"));
    expect(res.status).toBe(401);
  });

  it("returns empty list", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "k1",
      readOnly: false,
      label: "k",
    });
    vi.mocked(getAgentConfigsPage).mockResolvedValue({
      configs: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/agent-configs"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("returns configs for api key", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "k1",
      readOnly: false,
      label: "k",
    });
    vi.mocked(getAgentConfigsPage).mockResolvedValue({
      configs: [
        {
          id: "c1",
          name: "Default",
          description: null,
          agentId: "a",
          agentVersion: "1",
          config: {},
          configSchemaFingerprint: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } satisfies AgentConfigsPageResult);
    const res = await GET(new Request("http://localhost/api/agent-configs"));
    expect(res.status).toBe(200);
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getAgentConfigsPage).mockResolvedValue({
      configs: [],
      total: 25,
      page: 2,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/agent-configs?page=2&pageSize=10&q=prod&sort=createdAt&dir=desc",
      ),
    );

    expect(getAgentConfigsPage).toHaveBeenCalledWith(2, 10, {
      search: "prod",
      sortBy: "createdAt",
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
    vi.mocked(getAgentConfigsPage).mockResolvedValue({
      configs: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(new Request("http://localhost/api/agent-configs?sort=secret"));

    expect(getAgentConfigsPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "name",
      sortDir: "asc",
    });
  });
});

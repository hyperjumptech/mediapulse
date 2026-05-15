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
import { getAgentConfigsPage } from "@/lib/agent-configs";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

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
      configs: [{ id: "c1", name: "Default", agentId: "a", agentVersion: "1" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/agent-configs"));
    expect(res.status).toBe(200);
  });
});

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/agent-contracts", () => ({
  getAgentContractsPage: vi.fn(),
}));

import { GET } from "./route";
import { getAgentContractsPage } from "@/lib/agent-contracts";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

describe("GET /api/agent-contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without a principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(
      new Request("http://localhost/api/agent-contracts"),
    );

    expect(response.status).toBe(401);
    expect(getAgentContractsPage).not.toHaveBeenCalled();
  });

  it("passes search and sort through and pages the contracts", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getAgentContractsPage).mockResolvedValue({
      contracts: [{ id: "c1", name: "Brief", version: "1" }] as never,
      total: 21,
      page: 1,
      pageSize: 20,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/agent-contracts?q=brief&sort=createdAt&dir=desc",
      ),
    );
    const body = await response.json();

    expect(getAgentContractsPage).toHaveBeenCalledWith(1, 20, {
      search: "brief",
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(body).toMatchObject({
      items: [{ id: "c1" }],
      total: 21,
      hasMore: true,
    });
  });
});

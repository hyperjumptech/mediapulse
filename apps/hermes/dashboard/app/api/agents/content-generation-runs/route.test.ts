/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/content-generation-runs-api", () => ({
  listContentGenerationRuns: vi.fn(),
}));

import { GET } from "./route";
import { listContentGenerationRuns } from "@/lib/content-generation-runs-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const run = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  agentId: "content-generation",
  agentVersion: "1.0.0",
  tickerId: "ticker-1",
  outcome: "success" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("GET /api/agents/content-generation-runs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(
      new Request("http://localhost/api/agents/content-generation-runs"),
    );
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
    vi.mocked(listContentGenerationRuns).mockResolvedValue({ items: [] });
    const res = await GET(
      new Request("http://localhost/api/agents/content-generation-runs"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 20,
    });
  });

  it("returns runs with nextCursor for api key", async () => {
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
    vi.mocked(listContentGenerationRuns).mockResolvedValue({
      items: [run],
      nextCursor: "next",
    });
    const res = await GET(
      new Request(
        "http://localhost/api/agents/content-generation-runs?pageSize=10",
        { headers: { Authorization: "Bearer hmcp_ok" } },
      ),
    );
    expect(listContentGenerationRuns).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 10,
      outcome: undefined,
      tickerId: undefined,
      startTime: undefined,
      endTime: undefined,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [run],
      page: 1,
      pageSize: 10,
      nextCursor: "next",
    });
  });

  it("returns 400 when page > 1 without cursor", async () => {
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
    const res = await GET(
      new Request("http://localhost/api/agents/content-generation-runs?page=2"),
    );
    expect(res.status).toBe(400);
  });
});

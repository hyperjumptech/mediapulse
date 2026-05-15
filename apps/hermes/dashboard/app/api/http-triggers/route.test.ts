/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggersPage: vi.fn(),
}));

import { GET } from "./route";
import type { HttpTriggersPageResult } from "@/lib/http-triggers";
import { getHttpTriggersPage } from "@/lib/http-triggers";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

describe("GET /api/http-triggers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new Request("http://localhost/api/http-triggers"));
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
    vi.mocked(getHttpTriggersPage).mockResolvedValue({
      httpTriggers: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/http-triggers"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns http triggers for api key", async () => {
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
    vi.mocked(getHttpTriggersPage).mockResolvedValue({
      httpTriggers: [
        {
          id: "t1",
          name: "Hook",
          description: null,
          pipelineId: "p1",
          enabled: true,
          method: "POST",
          authType: "BEARER_TOKEN",
          tokenHash: "hash",
          tokenHint: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          lastTriggeredAt: null,
          createdById: null,
          pipeline: { id: "p1", name: "Pipe" },
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } satisfies HttpTriggersPageResult);
    const res = await GET(new Request("http://localhost/api/http-triggers"));
    expect(res.status).toBe(200);
  });
});

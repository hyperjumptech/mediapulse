/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesPage: vi.fn(),
}));

import { GET } from "./route";
import type { PipelinesPageResult } from "@/lib/pipelines";
import { getPipelinesPage } from "@/lib/pipelines";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

describe("GET /api/pipelines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new Request("http://localhost/api/pipelines"));
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
    vi.mocked(getPipelinesPage).mockResolvedValue({
      pipelines: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/pipelines"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns pipelines for api key", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "k1",
      readOnly: true,
      label: "k",
    });
    vi.mocked(getPipelinesPage).mockResolvedValue({
      pipelines: [
        {
          id: "p1",
          name: "Pipe",
          description: null,
          timeout: null,
          isActive: true,
          executionConfig: null,
          domainIntegrationId: "di-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdById: null,
          steps: [],
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } satisfies PipelinesPageResult);
    const res = await GET(
      new Request("http://localhost/api/pipelines", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );
    expect(res.status).toBe(200);
  });
});

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
      hasMore: false,
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
          eventName: null,
          authType: "BEARER_TOKEN",
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

    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("tokenHash");
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getHttpTriggersPage).mockResolvedValue({
      httpTriggers: [],
      total: 25,
      page: 2,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/http-triggers?page=2&pageSize=10&q=webhook&sort=method&dir=desc",
      ),
    );

    expect(getHttpTriggersPage).toHaveBeenCalledWith(2, 10, {
      search: "webhook",
      sortBy: "method",
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
    vi.mocked(getHttpTriggersPage).mockResolvedValue({
      httpTriggers: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(new Request("http://localhost/api/http-triggers?sort=secret"));

    expect(getHttpTriggersPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "name",
      sortDir: "asc",
    });
  });
});

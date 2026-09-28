/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/pipeline-summaries", () => ({
  getPipelineListItemsPage: vi.fn(),
}));

import { GET } from "./route";
import { getPipelineListItemsPage } from "@/lib/pipeline-summaries";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: {
    id: "u1",
    name: "A",
    email: "a@b.com",
    credentialVersion: 0,
  },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

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
    expect(getPipelineListItemsPage).not.toHaveBeenCalled();
  });

  it("returns pipeline summaries with the default sort", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getPipelineListItemsPage).mockResolvedValue({
      pipelines: [
        {
          id: "p1",
          name: "Pipe",
          description: null,
          isActive: true,
          stepCount: 2,
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(
      new Request("http://localhost/api/pipelines", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );

    expect(getPipelineListItemsPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      sortBy: "updated",
      sortDir: "desc",
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          id: "p1",
          name: "Pipe",
          description: null,
          isActive: true,
          stepCount: 2,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getPipelineListItemsPage).mockResolvedValue({
      pipelines: [],
      total: 11,
      page: 1,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/pipelines?pageSize=10&q=daily&sort=name&dir=asc",
      ),
    );

    expect(getPipelineListItemsPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      search: "daily",
      sortBy: "name",
      sortDir: "asc",
    });
    await expect(res.json()).resolves.toMatchObject({ hasMore: true });
  });
});

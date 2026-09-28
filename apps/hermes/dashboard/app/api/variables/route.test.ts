/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/variables", () => ({
  getVariablesPage: vi.fn(),
}));

import { GET } from "./route";
import { getVariablesPage } from "@/lib/variables";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { SECRET_MASK } from "@/lib/json-secret-mask";

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

describe("GET /api/variables", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new Request("http://localhost/api/variables"));
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
    vi.mocked(getVariablesPage).mockResolvedValue({
      variables: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/variables"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("returns redacted secret values from getVariablesPage", async () => {
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
    vi.mocked(getVariablesPage).mockResolvedValue({
      variables: [
        {
          id: "v1",
          key: "API_KEY",
          value: SECRET_MASK,
          note: null,
          isSecret: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/variables"));
    const body = (await res.json()) as {
      items: Array<{ value: string; isSecret: boolean }>;
    };
    expect(body.items[0]?.value).toBe(SECRET_MASK);
    expect(body.items[0]?.isSecret).toBe(true);
    expect(JSON.stringify(body)).not.toContain("sk-live");
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getVariablesPage).mockResolvedValue({
      variables: [],
      total: 25,
      page: 2,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/variables?page=2&pageSize=10&q=API&sort=created&dir=desc",
      ),
    );

    expect(getVariablesPage).toHaveBeenCalledWith(2, 10, {
      search: "API",
      sortBy: "created",
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
    vi.mocked(getVariablesPage).mockResolvedValue({
      variables: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(new Request("http://localhost/api/variables?sort=secret"));

    expect(getVariablesPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "key",
      sortDir: "asc",
    });
  });
});

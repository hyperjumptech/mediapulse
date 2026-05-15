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
});

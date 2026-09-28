/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationsPage: vi.fn(),
}));

import { GET } from "./route";
import { getDomainIntegrationsPage } from "@/lib/domain-integrations";
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

describe("GET /api/domain-integrations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(
      new Request("http://localhost/api/domain-integrations"),
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
    vi.mocked(getDomainIntegrationsPage).mockResolvedValue({
      integrations: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(
      new Request("http://localhost/api/domain-integrations"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("returns integrations without secrets", async () => {
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
    vi.mocked(getDomainIntegrationsPage).mockResolvedValue({
      integrations: [
        {
          id: "di-1",
          integrationId: "mediapulse",
          name: "Mediapulse",
          status: "active",
          baseUrl: "https://example.com",
          isDefault: true,
          isActive: true,
          createdById: "u1",
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(
      new Request("http://localhost/api/domain-integrations"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toMatch(/apiKey|plaintext|Bearer/i);
  });

  it("forwards q, sort, and dir and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      listPrincipal,
    );
    vi.mocked(getDomainIntegrationsPage).mockResolvedValue({
      integrations: [],
      total: 25,
      page: 2,
      pageSize: 10,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/domain-integrations?page=2&pageSize=10&q=news&sort=name&dir=desc",
      ),
    );

    expect(getDomainIntegrationsPage).toHaveBeenCalledWith(2, 10, {
      search: "news",
      sortBy: "name",
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
    vi.mocked(getDomainIntegrationsPage).mockResolvedValue({
      integrations: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(
      new Request("http://localhost/api/domain-integrations?sort=secret"),
    );

    expect(getDomainIntegrationsPage).toHaveBeenCalledWith(1, 20, {
      search: undefined,
      sortBy: "isDefault",
      sortDir: "desc",
    });
  });
});

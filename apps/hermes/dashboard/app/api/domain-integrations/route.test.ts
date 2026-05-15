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
});

/** @vitest-environment node */
import { dashboardManifestSchema } from "@hermes/domain-contract";
import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/domain-resource-table-api", () => ({
  resolveActiveDomainIntegrationOrNotFound: vi.fn(),
}));

import { GET } from "./route";
import { resolveActiveDomainIntegrationOrNotFound } from "@/lib/domain-resource-table-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const integration = {
  id: "i1",
  integrationId: "acme",
  name: "Acme",
  baseUrl: "http://localhost:3001",
  version: null,
  dashboard: dashboardManifestSchema.parse({
    views: [
      {
        id: "orders",
        label: "Orders",
        kind: "resource-table",
        pathSegment: "orders",
        apiPrefix: "/v1/orders",
        columns: [{ key: "reference", label: "Reference" }],
        searchableFields: ["reference"],
        sortableFields: ["reference"],
      },
      {
        id: "readme",
        label: "Readme",
        kind: "markdown",
        pathSegment: "readme",
        apiPrefix: "/v1/readme",
      },
    ],
  }),
  capabilities: ["preview-expansion" as const],
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const callRoute = (integrationId: string) =>
  GET(
    new Request(
      `http://localhost/api/domain-integrations/${integrationId}/views`,
    ),
    { params: Promise.resolve({ integrationId }) },
  );

describe("GET /api/domain-integrations/[integrationId]/views", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await callRoute("acme");

    expect(res.status).toBe(401);
    expect(resolveActiveDomainIntegrationOrNotFound).not.toHaveBeenCalled();
  });

  it("returns 404 when the integration is not active", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveActiveDomainIntegrationOrNotFound).mockResolvedValue(
      NextResponse.json({ error: "missing" }, { status: 404 }),
    );

    const res = await callRoute("missing");

    expect(res.status).toBe(404);
  });

  it("lists resource-table views with columns and fields", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveActiveDomainIntegrationOrNotFound).mockResolvedValue(
      integration,
    );

    const res = await callRoute("acme");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      integrationId: "acme",
      views: [
        {
          id: "orders",
          label: "Orders",
          pathSegment: "orders",
          columns: [{ key: "reference", label: "Reference", format: "text" }],
          searchableFields: ["reference"],
          sortableFields: ["reference"],
          filters: [],
        },
      ],
    });
  });
});

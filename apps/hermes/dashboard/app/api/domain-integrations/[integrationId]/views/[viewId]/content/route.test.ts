/** @vitest-environment node */
import { dashboardManifestSchema } from "@hermes/domain-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/domain-resource-table-api", () => ({
  resolveActiveDomainIntegrationOrNotFound: vi.fn(),
  domainIntegrationFailureResponse: (error: Error) =>
    NextResponse.json({ message: error.message }, { status: 502 }),
}));

vi.mock("@/lib/domain-content-view", () => ({
  fetchDomainContentView: vi.fn(),
}));

import { GET } from "./route";
import { fetchDomainContentView } from "@/lib/domain-content-view";
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
        id: "insights",
        label: "Insights",
        kind: "markdown",
        placement: "agent-tab",
        apiPrefix: "/v1/insights",
      },
    ],
  }),
  capabilities: [],
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const callRoute = (viewId: string, query = "") =>
  GET(new Request(`http://localhost/content${query}`), {
    params: Promise.resolve({ integrationId: "acme", viewId }),
  });

describe("GET /api/domain-integrations/[integrationId]/views/[viewId]/content", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a content view for an agent", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveActiveDomainIntegrationOrNotFound).mockResolvedValue(
      integration as never,
    );
    vi.mocked(fetchDomainContentView).mockResolvedValue({
      title: "Insights",
      body: "# Report",
    } as never);

    const response = await callRoute("insights", "?agentId=writer");
    const body = await response.json();

    expect(fetchDomainContentView).toHaveBeenCalledWith(
      expect.objectContaining({ integrationId: "acme", agentId: "writer" }),
    );
    expect(body).toEqual({
      viewId: "insights",
      kind: "markdown",
      title: "Insights",
      body: "# Report",
    });
  });

  it("returns 404 for a view that is not a content view", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveActiveDomainIntegrationOrNotFound).mockResolvedValue(
      integration as never,
    );

    const response = await callRoute("orders");

    expect(response.status).toBe(404);
    expect(fetchDomainContentView).not.toHaveBeenCalled();
  });
});

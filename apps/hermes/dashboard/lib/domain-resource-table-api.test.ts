/** @vitest-environment node */
import { dashboardManifestSchema } from "@hermes/domain-contract";
import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: vi.fn(),
}));

import { DomainIntegrationTimeoutError } from "./domain-integration-request";
import { getDomainIntegrationByIntegrationId } from "./domain-integrations";
import {
  domainIntegrationFailureResponse,
  resolveActiveDomainIntegrationOrNotFound,
  resolveDomainResourceTableViewOrNotFound,
} from "./domain-resource-table-api";

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
      },
    ],
  }),
  capabilities: ["preview-expansion" as const],
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("resolveActiveDomainIntegrationOrNotFound", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 404 when the integration is not active", async () => {
    vi.mocked(getDomainIntegrationByIntegrationId).mockResolvedValue(null);

    const result = await resolveActiveDomainIntegrationOrNotFound("missing");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns the integration record when active", async () => {
    vi.mocked(getDomainIntegrationByIntegrationId).mockResolvedValue(
      integration,
    );

    const result = await resolveActiveDomainIntegrationOrNotFound("acme");

    expect(result).toBe(integration);
  });
});

describe("resolveDomainResourceTableViewOrNotFound", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 404 for a resource that is not a registered table view", async () => {
    vi.mocked(getDomainIntegrationByIntegrationId).mockResolvedValue(
      integration,
    );

    const result = await resolveDomainResourceTableViewOrNotFound(
      "acme",
      "invoices",
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns the view for a registered resource", async () => {
    vi.mocked(getDomainIntegrationByIntegrationId).mockResolvedValue(
      integration,
    );

    const result = await resolveDomainResourceTableViewOrNotFound(
      "acme",
      "orders",
    );

    expect(result).toMatchObject({ id: "orders", pathSegment: "orders" });
  });
});

describe("domainIntegrationFailureResponse", () => {
  it("maps timeouts to 504", async () => {
    const response = domainIntegrationFailureResponse(
      new DomainIntegrationTimeoutError("acme", 5000, undefined),
    );

    expect(response.status).toBe(504);
  });

  it("maps other failures to 502 with the message", async () => {
    const response = domainIntegrationFailureResponse(
      new Error("Domain dashboard request failed (500)"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Domain integration request failed",
      message: "Domain dashboard request failed (500)",
    });
  });
});

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/domain-resource-table-api", () => ({
  resolveDomainResourceTableViewOrNotFound: vi.fn(),
  domainIntegrationFailureResponse: (error: Error) =>
    NextResponse.json({ message: error.message }, { status: 502 }),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableMeta: vi.fn(),
}));

import { GET } from "./route";
import { getDomainTableMeta } from "@/lib/domain-dashboard";
import { resolveDomainResourceTableViewOrNotFound } from "@/lib/domain-resource-table-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = () =>
  GET(
    new Request("http://localhost/api/domain-integrations/acme/orders/meta"),
    {
      params: Promise.resolve({ integrationId: "acme", resource: "orders" }),
    },
  );

describe("GET /api/domain-integrations/[integrationId]/[resource]/meta", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the live meta without custom action paths or tokens", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      {} as never,
    );
    vi.mocked(getDomainTableMeta).mockResolvedValue({
      title: "Orders",
      actions: { create: true, update: true, delete: false, view: true },
      createSchema: { type: "object" },
      customActions: [
        {
          id: "reset-all",
          label: "Reset all",
          ui: "danger-confirm",
          method: "POST",
          path: "/reset-all",
          confirmToken: "DELETE_ALL_ORDERS",
        },
      ],
    } as never);

    const response = await callRoute();
    const body = await response.json();

    expect(body).toMatchObject({
      title: "Orders",
      createSchema: { type: "object" },
      customActions: [{ id: "reset-all", ui: "danger-confirm" }],
    });
    expect(JSON.stringify(body)).not.toContain("DELETE_ALL_ORDERS");
    expect(body.customActions[0]).not.toHaveProperty("path");
  });

  it("returns the view lookup response when the view is unknown", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      NextResponse.json({ error: "View not found" }, { status: 404 }),
    );

    const response = await callRoute();

    expect(response.status).toBe(404);
    expect(getDomainTableMeta).not.toHaveBeenCalled();
  });
});

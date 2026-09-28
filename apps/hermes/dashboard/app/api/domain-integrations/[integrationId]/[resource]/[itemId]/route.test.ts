/** @vitest-environment node */
import { resourceTableViewSchema } from "@hermes/domain-contract";
import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/domain-resource-table-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/domain-resource-table-api")>();

  return { ...actual, resolveDomainResourceTableViewOrNotFound: vi.fn() };
});

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableItemById: vi.fn(),
}));

import { GET } from "./route";
import { getDomainTableItemById } from "@/lib/domain-dashboard";
import { resolveDomainResourceTableViewOrNotFound } from "@/lib/domain-resource-table-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const ordersView = resourceTableViewSchema.parse({
  id: "orders",
  label: "Orders",
  kind: "resource-table",
  pathSegment: "orders",
  apiPrefix: "/v1/orders",
});

const callRoute = (itemId: string) =>
  GET(
    new Request(
      `http://localhost/api/domain-integrations/acme/orders/${encodeURIComponent(itemId)}`,
    ),
    {
      params: Promise.resolve({
        integrationId: "acme",
        resource: "orders",
        itemId,
      }),
    },
  );

describe("GET /api/domain-integrations/[integrationId]/[resource]/[itemId]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await callRoute("o1");

    expect(res.status).toBe(401);
  });

  it.each(["..", ".", "a/b"])(
    "rejects the unsafe item id %s",
    async (itemId) => {
      vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
        apiKeyPrincipal,
      );

      const res = await callRoute(itemId);

      expect(res.status).toBe(400);
      expect(getDomainTableItemById).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the domain has no such row", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableItemById).mockResolvedValue(null);

    const res = await callRoute("o404");

    expect(res.status).toBe(404);
  });

  it("returns the row from the domain", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableItemById).mockResolvedValue({
      id: "o1",
      reference: "R-1",
    });

    const res = await callRoute("o1");

    expect(getDomainTableItemById).toHaveBeenCalledWith("acme", "orders", "o1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "o1", reference: "R-1" });
  });

  it("returns 502 when the domain request fails", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableItemById).mockRejectedValue(new Error("boom"));

    const res = await callRoute("o1");

    expect(res.status).toBe(502);
  });
});

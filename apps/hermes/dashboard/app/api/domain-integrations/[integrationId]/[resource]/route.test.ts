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
  getDomainTableList: vi.fn(),
}));

import { GET } from "./route";
import { getDomainTableList } from "@/lib/domain-dashboard";
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
  sortableFields: ["reference", "createdAt"],
  defaultSort: { sortBy: "createdAt", sortDir: "desc" },
  listFilters: [
    {
      key: "status",
      label: "Status",
      ui: "select",
      staticOptions: [{ value: "open", label: "Open" }],
    },
    {
      key: "created",
      label: "Created",
      ui: "date-range",
      rangeParams: { from: "from", to: "to" },
    },
  ],
});

const callRoute = (query: string) =>
  GET(
    new Request(`http://localhost/api/domain-integrations/acme/orders${query}`),
    { params: Promise.resolve({ integrationId: "acme", resource: "orders" }) },
  );

describe("GET /api/domain-integrations/[integrationId]/[resource]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await callRoute("");

    expect(res.status).toBe(401);
    expect(getDomainTableList).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown resource without calling the domain", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      NextResponse.json({ error: "missing" }, { status: 404 }),
    );

    const res = await callRoute("");

    expect(res.status).toBe(404);
    expect(getDomainTableList).not.toHaveBeenCalled();
  });

  it("forwards search, sort, and manifest filters and reports hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableList).mockResolvedValue({
      items: [{ id: "o1" }],
      total: 12,
      page: 2,
      pageSize: 5,
    });

    const res = await callRoute(
      "?page=2&pageSize=5&q=abc&sort=reference&dir=asc&status=open&from=2026-01-01&unknown=x",
    );

    expect(getDomainTableList).toHaveBeenCalledWith("acme", "orders", {
      page: 2,
      pageSize: 5,
      query: "abc",
      sortBy: "reference",
      sortDir: "asc",
      filters: { status: "open", from: "2026-01-01" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [{ id: "o1" }],
      total: 12,
      page: 2,
      pageSize: 5,
      hasMore: true,
    });
  });

  it("uses the manifest default sort when the sort field is not sortable", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableList).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await callRoute("?sort=secret");

    expect(getDomainTableList).toHaveBeenCalledWith(
      "acme",
      "orders",
      expect.objectContaining({ sortBy: "createdAt", sortDir: "desc" }),
    );
  });

  it("returns 502 when the domain request fails", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(resolveDomainResourceTableViewOrNotFound).mockResolvedValue(
      ordersView,
    );
    vi.mocked(getDomainTableList).mockRejectedValue(
      new Error("Domain dashboard request failed (500)"),
    );

    const res = await callRoute("");

    expect(res.status).toBe(502);
  });
});

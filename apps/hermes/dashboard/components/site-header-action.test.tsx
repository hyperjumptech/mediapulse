import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceTableView } from "@hermes/domain-contract";

import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

import { SiteHeaderAction } from "./site-header-action";

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/dashboard" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

const itemsView: ResourceTableView = {
  id: "items",
  label: "Items",
  pathSegment: "items",
  kind: "resource-table",
  placement: "sidebar",
  apiPrefix: "/v1/items",
  columns: [],
  searchableFields: [],
  sortableFields: [],
  actions: { create: true, update: true, delete: true, view: true },
  order: 0,
  customActions: [],
  createNavigation: "modal",
  createSchema: { type: "object", properties: { name: { type: "string" } } },
};

const domainIntegrations: DomainIntegrationNav[] = [
  { integrationId: "acme", name: "Acme", views: [itemsView] },
];

const renderResolved = async (integrations: DomainIntegrationNav[]) => {
  await act(async () => {
    render(
      <SiteHeaderAction domainIntegrations={Promise.resolve(integrations)} />,
    );
  });
};

afterEach(() => {
  pathname.current = "/dashboard";
});

describe("SiteHeaderAction", () => {
  it("offers Quick Create on the overview", async () => {
    await renderResolved([]);

    expect(
      screen.getByRole("button", { name: "Quick create" }),
    ).toBeInTheDocument();
  });

  it("shows the page's own primary action on a list page", async () => {
    pathname.current = "/dashboard/variables";

    await renderResolved([]);

    expect(screen.getByRole("link", { name: "Add variable" })).toHaveAttribute(
      "href",
      "/dashboard/variables?create=1",
    );
    expect(
      screen.queryByRole("button", { name: "Quick create" }),
    ).not.toBeInTheDocument();
  });

  it("links to a full create page when the page has one", async () => {
    pathname.current = "/dashboard/agent-configs";

    await renderResolved([]);

    expect(screen.getByRole("link", { name: "Add config" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/new",
    );
  });

  it("shows nothing on pages without a primary action", async () => {
    pathname.current = "/dashboard/agents";

    await renderResolved(domainIntegrations);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows nothing on a domain table the manifest does not let admins add to", async () => {
    pathname.current = "/dashboard/acme/items";

    await renderResolved([
      {
        integrationId: "acme",
        name: "Acme",
        views: [
          {
            ...itemsView,
            actions: { create: false, update: true, delete: true, view: true },
          },
        ],
      },
    ]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the Hermes action while domain integrations are loading", async () => {
    pathname.current = "/dashboard/variables";
    const pendingIntegrations = new Promise<DomainIntegrationNav[]>(() => {});

    await act(async () => {
      render(<SiteHeaderAction domainIntegrations={pendingIntegrations} />);
    });

    expect(
      screen.getByRole("link", { name: "Add variable" }),
    ).toBeInTheDocument();
  });

  it("opens the create dialog of a domain table once integrations load", async () => {
    pathname.current = "/dashboard/acme/items";

    await renderResolved(domainIntegrations);

    expect(screen.getByRole("link", { name: "Add Items" })).toHaveAttribute(
      "href",
      "/dashboard/acme/items?create=1",
    );
  });

  it("links a full-page domain table to its new item page", async () => {
    pathname.current = "/dashboard/acme/items";
    const fullPageIntegrations: DomainIntegrationNav[] = [
      {
        integrationId: "acme",
        name: "Acme",
        views: [{ ...itemsView, createNavigation: "full-page" }],
      },
    ];

    await renderResolved(fullPageIntegrations);

    expect(screen.getByRole("link", { name: "Add Items" })).toHaveAttribute(
      "href",
      "/dashboard/acme/items/new",
    );
  });
});

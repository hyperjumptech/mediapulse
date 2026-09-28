import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardPage } from "@hermes/domain-contract";

import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

import {
  BreadcrumbEntityLabel,
  BreadcrumbEntityLabelsProvider,
} from "./breadcrumb-entity-label";
import { DashboardBreadcrumbs } from "./dashboard-breadcrumbs";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const PIPELINE_ID = "550e8400-e29b-41d4-a716-446655440000";

const searchQueriesView: DashboardPage = {
  id: "search-queries",
  label: "Search Queries",
  pathSegment: "search-queries",
  kind: "resource-table",
  placement: "sidebar",
  apiPrefix: "/v1/hermes-dashboard/search-queries",
  columns: [],
  searchableFields: [],
  sortableFields: [],
  actions: { create: true, update: true, delete: true, view: false },
  order: 0,
  customActions: [],
  createNavigation: "modal",
};

const mediapulseIntegrations: DomainIntegrationNav[] = [
  {
    integrationId: "mediapulse",
    name: "MediaPulse",
    views: [searchQueriesView],
  },
];

const renderBreadcrumbs = async (
  domainIntegrations: Promise<DomainIntegrationNav[]>,
  children?: React.ReactNode,
) => {
  await act(async () => {
    render(
      <BreadcrumbEntityLabelsProvider>
        <DashboardBreadcrumbs domainIntegrations={domainIntegrations} />
        {children}
      </BreadcrumbEntityLabelsProvider>,
    );
  });
};

const getCurrentPage = () => {
  const navigation = screen.getByRole("navigation", { name: "breadcrumb" });

  return within(navigation).getByText(
    (_content, element) => element?.getAttribute("aria-current") === "page",
  );
};

describe("DashboardBreadcrumbs", () => {
  afterEach(() => {
    usePathnameMock.mockReset();
  });

  it("shows Dashboard as the current page on /dashboard", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderBreadcrumbs(Promise.resolve([]));

    // Assert
    expect(getCurrentPage()).toHaveTextContent("Dashboard");
  });

  it("links ancestors and marks the last crumb as the current page", async () => {
    // Setup
    usePathnameMock.mockReturnValue(`/dashboard/pipelines/${PIPELINE_ID}`);

    // Act
    await renderBreadcrumbs(Promise.resolve([]));

    // Assert
    expect(screen.getByRole("link", { name: "Pipelines" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines",
    );
    expect(getCurrentPage()).toHaveTextContent("Pipeline");
  });

  it("shows a label published by the page", async () => {
    // Setup
    usePathnameMock.mockReturnValue(`/dashboard/pipelines/${PIPELINE_ID}`);

    // Act
    await renderBreadcrumbs(
      Promise.resolve([]),
      <BreadcrumbEntityLabel segment={PIPELINE_ID} label="Nightly ingest" />,
    );

    // Assert
    expect(getCurrentPage()).toHaveTextContent("Nightly ingest");
  });

  it("renders an ancestor without a page as plain text", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/agent-configs/config-1/edit");

    // Act
    await renderBreadcrumbs(Promise.resolve([]));

    // Assert
    expect(screen.getByText("Agent config")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Agent config" }),
    ).not.toBeInTheDocument();
    expect(getCurrentPage()).toHaveTextContent("Edit");
  });

  it("hides ancestors on small screens but keeps the current page", async () => {
    // Setup
    usePathnameMock.mockReturnValue(`/dashboard/pipelines/${PIPELINE_ID}`);

    // Act
    await renderBreadcrumbs(Promise.resolve([]));

    // Assert
    const ancestorItem = screen
      .getByRole("link", { name: "Pipelines" })
      .closest("li");
    const currentItem = getCurrentPage().closest("li");

    expect(ancestorItem).toHaveClass("hidden", "md:flex");
    expect(currentItem).not.toHaveClass("hidden");
  });

  it("uses integration names once the nav data resolves", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/search-queries");

    // Act
    await renderBreadcrumbs(Promise.resolve(mediapulseIntegrations));

    // Assert
    expect(screen.getByText("MediaPulse")).toBeInTheDocument();
    expect(getCurrentPage()).toHaveTextContent("Search Queries");
  });

  it("renders humanized crumbs while the nav data is pending", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/mediapulse/search-queries");
    const pendingIntegrations = new Promise<DomainIntegrationNav[]>(() => {});

    // Act
    await renderBreadcrumbs(pendingIntegrations);

    // Assert
    expect(screen.getByText("Mediapulse")).toBeInTheDocument();
    expect(getCurrentPage()).toHaveTextContent("Search queries");
  });
});

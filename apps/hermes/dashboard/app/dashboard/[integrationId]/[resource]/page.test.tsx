import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const domainTablePageMock = vi.fn();
const domainContentViewPageMock = vi.fn();
const getDomainIntegrationByIntegrationIdMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundMock();
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationIdMock(...args),
}));

vi.mock("@/app/dashboard/domain-table-page", () => ({
  DomainTablePage: (props: unknown) => {
    domainTablePageMock(props);
    return <div data-testid="domain-table-page">Domain page</div>;
  },
}));

vi.mock("@/app/dashboard/domain-content-view-page", () => ({
  default: (props: unknown) => {
    domainContentViewPageMock(props);
    return <div data-testid="domain-content-view-page">Content view</div>;
  },
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import IntegrationDashboardViewPage from "./page";

describe("IntegrationDashboardViewPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    domainTablePageMock.mockReset();
    domainContentViewPageMock.mockReset();
  });

  it("renders resource-table view via DomainTablePage", async () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      dashboard: {
        views: [
          {
            id: "tickers",
            kind: "resource-table",
            placement: "sidebar",
            pathSegment: "tickers",
            label: "Tickers",
            order: 1,
            apiPrefix: "/v1/tickers",
            columns: [],
            searchableFields: [],
            sortableFields: [],
            actions: {},
          },
        ],
      },
    });

    const component = await IntegrationDashboardViewPage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "tickers",
      }),
      searchParams: {},
    });
    render(component);

    expect(screen.getByTestId("domain-table-page")).toBeInTheDocument();
    expect(domainTablePageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: "mediapulse",
        resource: "tickers",
        searchParams: {},
      }),
    );
  });

  it("renders html content view via DomainContentViewPage", async () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      dashboard: {
        views: [
          {
            id: "coverage",
            kind: "html",
            placement: "sidebar",
            pathSegment: "section-coverage",
            label: "Coverage",
            order: 2,
            apiPrefix: "/v1/coverage",
          },
        ],
      },
    });

    const component = await IntegrationDashboardViewPage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "section-coverage",
      }),
      searchParams: {},
    });
    render(component);

    expect(screen.getByTestId("domain-content-view-page")).toBeInTheDocument();
    expect(domainContentViewPageMock).toHaveBeenCalled();
  });

  it("calls notFound when integration is missing", async () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(null);

    await expect(
      IntegrationDashboardViewPage({
        params: Promise.resolve({
          integrationId: "unknown",
          resource: "tickers",
        }),
        searchParams: {},
      }),
    ).rejects.toThrow("notFound");

    expect(notFoundMock).toHaveBeenCalled();
  });
});

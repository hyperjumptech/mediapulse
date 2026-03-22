import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const domainTablePageMock = vi.fn();

vi.mock("@/app/dashboard/domain-table-page", () => ({
  DomainTablePage: (props: unknown) => {
    domainTablePageMock(props);
    return <div data-testid="domain-table-page">Domain page</div>;
  },
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import IntegrationDomainTablePage from "./page";

describe("IntegrationDomainTablePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    domainTablePageMock.mockReset();
  });

  it("renders domain table page", async () => {
    const component = await IntegrationDomainTablePage({
      params: Promise.resolve({
        integrationKey: "mediapulse",
        resource: "tickers",
      }),
      searchParams: {},
    });
    render(component);

    expect(screen.getByTestId("domain-table-page")).toBeInTheDocument();
  });

  it("passes integration key, resource and search params", async () => {
    const searchParams = { q: "AAPL" };

    const component = await IntegrationDomainTablePage({
      params: Promise.resolve({
        integrationKey: "mediapulse",
        resource: "tickers",
      }),
      searchParams,
    });
    render(component);

    expect(domainTablePageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationKey: "mediapulse",
        resource: "tickers",
        searchParams,
      }),
    );
  });
});

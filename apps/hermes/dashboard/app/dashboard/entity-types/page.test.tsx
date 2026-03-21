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

import EntityTypesPage from "./page";

describe("EntityTypesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    domainTablePageMock.mockReset();
  });

  it("renders domain table page", async () => {
    // Act
    const component = await EntityTypesPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("domain-table-page")).toBeInTheDocument();
    expect(domainTablePageMock).toHaveBeenCalledWith(
      expect.objectContaining({ resource: "entity-types" }),
    );
  });
});

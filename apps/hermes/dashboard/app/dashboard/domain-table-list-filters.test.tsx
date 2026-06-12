import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DomainTableListFilters } from "./domain-table-list-filters";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
  }: React.PropsWithChildren<{ type?: "submit" | "button" }>) => (
    <button type={type}>{children}</button>
  ),
}));

describe("DomainTableListFilters", () => {
  it("renders a type dropdown when listFilters includes typeId", () => {
    // Act
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/entities"
        listFilters={["typeId"]}
        entityTypeOptions={[
          { value: "type-1", label: "Company" },
          { value: "type-2", label: "Person" },
        ]}
        typeId="type-1"
        preserveParams={{}}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Type")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Company" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Person" })).toBeTruthy();
  });

  it("returns null when no supported filters are declared", () => {
    // Act
    const { container } = render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/tickers"
        listFilters={[]}
        preserveParams={{}}
      />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders collected-by filter when listFilters includes collectionSource", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/data-sources"
        listFilters={["collectionSource"]}
        collectionSourceOptions={[
          { value: "page-collection", label: "Page Collection" },
          { value: "data-collection", label: "Data Collection" },
        ]}
        collectionSource="page-collection"
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Collected by")).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Page Collection" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Data Collection" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toBeTruthy();
  });

  it("renders intent, source, and active set filters when declared", () => {
    // Act
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/search-queries"
        listFilters={["isActive", "intent", "source"]}
        intentOptions={[{ value: "breaking", label: "breaking" }]}
        sourceOptions={[{ value: "llm", label: "llm" }]}
        intent="breaking"
        source="llm"
        isActive="true"
        preserveParams={{}}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Active set")).toBeTruthy();
    expect(screen.getByLabelText("Intent")).toBeTruthy();
    expect(screen.getByLabelText("Source")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Yes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toBeTruthy();
  });
});

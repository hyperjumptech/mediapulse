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
  it("renders a select filter from manifest definitions and meta options", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/entities"
        listFilters={[
          {
            key: "typeId",
            label: "Type",
            ui: "select",
            placeholderAll: "All types",
            optionsMetaKey: "entityTypeOptions",
          },
        ]}
        filterOptions={{
          entityTypeOptions: [
            { value: "type-1", label: "Company" },
            { value: "type-2", label: "Person" },
          ],
        }}
        filterValues={{ typeId: "type-1" }}
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Type")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Company" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Person" })).toBeTruthy();
  });

  it("returns null when no filters are declared", () => {
    const { container } = render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/tickers"
        listFilters={[]}
        filterValues={{}}
        preserveParams={{}}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders domain-owned select filters generically", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/data-sources"
        listFilters={[
          {
            key: "collectionSource",
            label: "Collected by",
            ui: "select",
            optionsMetaKey: "collectionSourceOptions",
          },
        ]}
        filterOptions={{
          collectionSourceOptions: [
            { value: "page-collection", label: "Page Collection" },
            { value: "data-collection", label: "Data Collection" },
          ],
        }}
        filterValues={{ collectionSource: "page-collection" }}
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

  it("renders boolean-select filters when declared", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/search-queries"
        listFilters={[
          {
            key: "isActive",
            label: "Active set",
            ui: "boolean-select",
          },
          {
            key: "intent",
            label: "Intent",
            ui: "select",
            optionsMetaKey: "intentOptions",
          },
          {
            key: "source",
            label: "Source",
            ui: "select",
            optionsMetaKey: "sourceOptions",
          },
        ]}
        filterOptions={{
          intentOptions: [{ value: "breaking", label: "breaking" }],
          sourceOptions: [{ value: "llm", label: "llm" }],
        }}
        filterValues={{
          intent: "breaking",
          source: "llm",
          isActive: "true",
        }}
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Active set")).toBeTruthy();
    expect(screen.getByLabelText("Intent")).toBeTruthy();
    expect(screen.getByLabelText("Source")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Yes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toBeTruthy();
  });
});

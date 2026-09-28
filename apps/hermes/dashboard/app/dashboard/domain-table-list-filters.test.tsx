import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DomainTableListFilters } from "./domain-table-list-filters";

vi.mock("next/form", () => ({
  default: ({
    children,
    action,
    ...props
  }: React.ComponentProps<"form"> & { action: string }) => (
    <form data-action={action} {...props}>
      {children}
    </form>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
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

  it("submits through next/form to the base path with preserved params as hidden inputs", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/entities"
        listFilters={[
          {
            key: "typeId",
            label: "Type",
            ui: "select",
            optionsMetaKey: "entityTypeOptions",
          },
        ]}
        filterOptions={{
          entityTypeOptions: [{ value: "type-1", label: "Company" }],
        }}
        filterValues={{}}
        preserveParams={{ sort: "name", dir: "asc", q: "acme" }}
      />,
    );

    const form = screen.getByRole("search", { name: "Filter list" });
    expect(form).toHaveAttribute(
      "data-action",
      "/dashboard/mediapulse/entities",
    );
    expect(form).not.toHaveAttribute("method");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("name");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("asc");
    expect(form.querySelector('input[name="q"]')).toHaveValue("acme");
  });

  it("names a bare All option after its filter so compact selects stay readable", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/acme/items"
        listFilters={[
          {
            key: "source",
            label: "Collected by",
            ui: "select",
            placeholderAll: "All",
          },
          {
            key: "owner",
            label: "Owner",
            ui: "select",
            placeholderAll: "All owners",
          },
        ]}
        filterValues={{}}
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Collected by")).toHaveDisplayValue(
      "Collected by: All",
    );
    expect(screen.getByLabelText("Owner")).toHaveDisplayValue("All owners");
  });

  it("renders date ranges as date inputs beside an apply button", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/acme/items"
        listFilters={[
          {
            key: "createdAt",
            label: "Created",
            ui: "date-range",
            rangeParams: { from: "createdFrom", to: "createdTo" },
          },
        ]}
        filterValues={{ createdFrom: "2026-07-01" }}
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Created from")).toHaveAttribute(
      "type",
      "date",
    );
    expect(screen.getByLabelText("Created from")).toHaveValue("2026-07-01");
    expect(screen.getByLabelText("Created to")).toHaveAttribute(
      "name",
      "createdTo",
    );
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("uses the compact toolbar control height", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/acme/items"
        listFilters={[
          { key: "isActive", label: "Active", ui: "boolean-select" },
          {
            key: "createdAt",
            label: "Created",
            ui: "date-range",
            rangeParams: { from: "from", to: "to" },
          },
        ]}
        filterValues={{ isActive: "true" }}
        preserveParams={{}}
      />,
    );

    expect(screen.getByLabelText("Active")).toHaveAttribute("data-size", "sm");
    expect(screen.getByLabelText("Created from")).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
      "data-size",
      "sm",
    );
    expect(
      screen.getByRole("link", { name: /Clear filters/i }),
    ).toHaveAttribute("data-size", "sm");
  });

  it("hides the clear link when no filter is active", () => {
    render(
      <DomainTableListFilters
        basePath="/dashboard/acme/items"
        listFilters={[
          { key: "isActive", label: "Active", ui: "boolean-select" },
        ]}
        filterValues={{}}
        preserveParams={{}}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /Clear filters/i }),
    ).not.toBeInTheDocument();
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

  it("does not emit duplicate filter names when preserving sort and search", () => {
    const { container } = render(
      <DomainTableListFilters
        basePath="/dashboard/mediapulse/data-sources"
        listFilters={[
          {
            key: "tickerId",
            label: "Ticker",
            ui: "select",
            optionsMetaKey: "tickerOptions",
          },
          {
            key: "collectionSource",
            label: "Collected by",
            ui: "select",
            optionsMetaKey: "collectionSourceOptions",
          },
          {
            key: "createdAt",
            label: "Created",
            ui: "date-range",
            rangeParams: { from: "from", to: "to" },
          },
        ]}
        filterOptions={{
          tickerOptions: [{ value: "ticker-1", label: "Acme" }],
          collectionSourceOptions: [
            { value: "page-collection", label: "Page Collection" },
            { value: "data-collection", label: "Data Collection" },
          ],
        }}
        filterValues={{
          tickerId: "ticker-1",
          collectionSource: "page-collection",
          from: "2026-07-01",
          to: "2026-07-14",
        }}
        preserveParams={{
          sort: "createdAt",
          dir: "desc",
          q: "acme",
        }}
      />,
    );

    const namedControls = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input[name], select[name]",
      ),
    );
    const names = namedControls.map((control) => control.name);
    const clearHref = screen
      .getByRole("link", { name: /Clear filters/i })
      .getAttribute("href");

    expect(names.filter((name) => name === "tickerId")).toHaveLength(1);
    expect(names.filter((name) => name === "collectionSource")).toHaveLength(1);
    expect(names.filter((name) => name === "from")).toHaveLength(1);
    expect(names.filter((name) => name === "to")).toHaveLength(1);
    expect(names.filter((name) => name === "sort")).toHaveLength(1);
    expect(names.filter((name) => name === "dir")).toHaveLength(1);
    expect(names.filter((name) => name === "q")).toHaveLength(1);
    expect(clearHref).toBe(
      "/dashboard/mediapulse/data-sources?sort=createdAt&dir=desc&q=acme",
    );
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DomainTableSortableHeader } from "./domain-table-sortable-header";

const columns = [
  { key: "symbol", label: "Symbol", type: "text" as const },
  { key: "name", label: "Name", type: "text" as const },
  { key: "createdAt", label: "Created", type: "date-time" as const },
];

const renderHeader = (
  overrides: Partial<React.ComponentProps<typeof DomainTableSortableHeader>>,
) =>
  render(
    <table>
      <DomainTableSortableHeader
        columns={columns}
        sortableFields={["symbol", "createdAt"]}
        sortBy="symbol"
        sortDir="asc"
        basePath="/dashboard/acme/tickers"
        pageSize={20}
        hasRowActions
        {...overrides}
      />
    </table>,
  );

describe("DomainTableSortableHeader", () => {
  it("links sortable columns and leaves the others as plain labels", () => {
    // Act
    renderHeader({});

    // Assert
    expect(screen.getByRole("link", { name: "Symbol" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Created" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Name" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
  });

  it("flips the active column and resets page while preserving search and filters", () => {
    // Act
    renderHeader({
      searchQuery: "acme",
      preserveParams: { sector: "energy" },
    });

    // Assert
    const activeLink = screen.getByRole("link", { name: "Symbol" });
    const inactiveLink = screen.getByRole("link", { name: "Created" });

    expect(activeLink).toHaveAttribute("aria-sort", "ascending");
    expect(activeLink).toHaveAttribute(
      "href",
      "/dashboard/acme/tickers?page=1&size=20&q=acme&sort=symbol&dir=desc&sector=energy",
    );
    expect(inactiveLink).not.toHaveAttribute("aria-sort");
    expect(inactiveLink).toHaveAttribute(
      "href",
      "/dashboard/acme/tickers?page=1&size=20&q=acme&sort=createdAt&dir=asc&sector=energy",
    );
  });

  it("sorts ascending when a descending column is clicked again", () => {
    // Act
    renderHeader({ sortBy: "createdAt", sortDir: "desc" });

    // Assert
    const activeLink = screen.getByRole("link", { name: "Created" });

    expect(activeLink).toHaveAttribute("aria-sort", "descending");
    expect(activeLink).toHaveAttribute(
      "href",
      "/dashboard/acme/tickers?page=1&size=20&sort=createdAt&dir=asc",
    );
  });

  it("treats every column as inactive when no sort is set", () => {
    // Act
    renderHeader({ sortBy: undefined });

    // Assert
    expect(screen.getByRole("link", { name: "Symbol" })).not.toHaveAttribute(
      "aria-sort",
    );
  });

  it("adds an actions column only when rows have actions", () => {
    // Act
    const { rerender } = renderHeader({});
    const withActions = screen.getAllByRole("columnheader");

    rerender(
      <table>
        <DomainTableSortableHeader
          columns={columns}
          sortableFields={[]}
          sortDir="asc"
          basePath="/dashboard/acme/tickers"
          pageSize={20}
          hasRowActions={false}
        />
      </table>,
    );

    // Assert
    expect(withActions).toHaveLength(4);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });
});

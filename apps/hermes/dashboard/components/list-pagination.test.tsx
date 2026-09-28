import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListPagination, describeVisibleRange } from "./list-pagination";

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

describe("describeVisibleRange", () => {
  it.each([
    [1, 15, 230, "Showing 1–15 of 230"],
    [2, 15, 30, "Showing 16–30 of 30"],
    [3, 15, 40, "Showing 31–40 of 40"],
    [70, 15, 1_234, "Showing 1,036–1,050 of 1,234"],
  ])(
    "describes page %d of size %d with %d items",
    (page, pageSize, total, expected) => {
      // Act
      const label = describeVisibleRange(page, pageSize, total);

      // Assert
      expect(label).toBe(expected);
    },
  );

  it("falls back to the total when the page is past the last item", () => {
    // Act
    const label = describeVisibleRange(5, 15, 20);

    // Assert
    expect(label).toBe("20 total");
  });
});

describe("ListPagination", () => {
  it("renders the visible range", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText("Showing 1–15 of 30")).toBeInTheDocument();
  });

  it("renders previous and next links in the middle of the list", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={2}
        pageSize={15}
        total={45}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "rel",
      "prev",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "rel",
      "next",
    );
  });

  it("disables Previous on first page", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Previous page" }),
    ).not.toBeInTheDocument();
  });

  it("disables Next on last page", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={2}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Next page" }),
    ).not.toBeInTheDocument();
  });

  it("constructs correct Previous href with sort params", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={3}
        pageSize={15}
        total={60}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers?page=2&size=15&sort=symbol&dir=asc",
    );
  });

  it("constructs correct Next href", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers?page=2&size=15&sort=symbol&dir=asc",
    );
  });

  it("includes search query in pagination links", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        searchQuery="AAPL"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers?page=2&size=15&q=AAPL&sort=symbol&dir=asc",
    );
  });

  it("returns null when total fits in one page", () => {
    // Act
    const { container } = render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={10}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders navigation with aria-label", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("navigation", { name: "Tickers list pagination" }),
    ).toBeInTheDocument();
  });

  it("builds minimal query when only page and size", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/schedules/sched-1"
        page={1}
        pageSize={10}
        total={25}
        ariaLabel="Executions pagination"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1?page=2&size=10",
    );
  });

  it("includes extra params in pagination links", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/mediapulse/search-queries"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Search queries pagination"
        extraParams={{ ticker: "Apple" }}
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/search-queries?page=2&size=15&ticker=Apple",
    );
  });
});

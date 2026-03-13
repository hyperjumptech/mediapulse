import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListPagination } from "./list-pagination";

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
    disabled,
    asChild,
  }: React.PropsWithChildren<{ disabled?: boolean; asChild?: boolean }>) => (
    <button disabled={disabled} data-as-child={asChild}>
      {children}
    </button>
  ),
}));

describe("ListPagination", () => {
  it("renders page info text", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText("Page 1 of 2 (30 total)")).toBeInTheDocument();
  });

  it("renders Previous and Next buttons", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={2}
        pageSize={15}
        total={45}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.getByText(/Next/)).toBeInTheDocument();
  });

  it("disables Previous on first page", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const prevButton = screen.getByText(/Previous/).closest("button");
    expect(prevButton).toBeDisabled();
  });

  it("enables Previous on page 2", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={2}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toBeInTheDocument();
  });

  it("disables Next on last page", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={2}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const nextButton = screen.getByText(/Next/).closest("button");
    expect(nextButton).toBeDisabled();
  });

  it("enables Next when not on last page", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toBeInTheDocument();
  });

  it("constructs correct Previous href with sort params", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={3}
        pageSize={15}
        total={60}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toHaveAttribute(
      "href",
      "/dashboard/tickers?page=2&size=15&sort=symbol&dir=asc",
    );
  });

  it("constructs correct Next href", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
        page={1}
        pageSize={15}
        total={30}
        ariaLabel="Tickers list pagination"
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/tickers?page=2&size=15&sort=symbol&dir=asc",
    );
  });

  it("includes search query in pagination links", () => {
    // Act
    render(
      <ListPagination
        basePath="/dashboard/tickers"
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
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/tickers?page=2&size=15&q=AAPL&sort=symbol&dir=asc",
    );
  });

  it("returns null when total fits in one page", () => {
    // Act
    const { container } = render(
      <ListPagination
        basePath="/dashboard/tickers"
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
        basePath="/dashboard/tickers"
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
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1?page=2&size=10",
    );
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DomainTableSearch } from "./domain-table-search";

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
  Button: ({ children, type }: React.PropsWithChildren<{ type?: string }>) => (
    <button type={type as "submit" | "button" | "reset"}>{children}</button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

describe("DomainTableSearch", () => {
  it("renders search form with role and aria-label", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery=""
        pageSize={15}
        sortBy="name"
        sortDir="asc"
        ariaLabel="Search tickers"
      />,
    );

    expect(
      screen.getByRole("search", { name: "Search tickers" }),
    ).toBeInTheDocument();
  });

  it("renders placeholder and submit button", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery=""
        pageSize={15}
        sortDir="asc"
        ariaLabel="Search"
        placeholder="Search by symbol…"
      />,
    );

    expect(
      screen.getByPlaceholderText("Search by symbol…"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("shows clear search link when query is active", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery="abc"
        pageSize={20}
        sortBy="id"
        sortDir="desc"
        ariaLabel="Search"
      />,
    );

    expect(screen.getByText("Clear search")).toBeInTheDocument();
  });

  it("constructs clear href with base path and preserved params", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery="x"
        pageSize={20}
        sortBy="id"
        sortDir="desc"
        ariaLabel="Search"
      />,
    );

    const clearLink = screen.getByRole("link", { name: /Clear search/i });
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/mp/tickers?size=20&dir=desc&sort=id",
    );
  });

  it("omits sort from clear href when sortBy is undefined", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/items"
        initialQuery="x"
        pageSize={15}
        sortDir="asc"
        ariaLabel="Search"
      />,
    );

    const clearLink = screen.getByRole("link", { name: /Clear search/i });
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/mp/items?size=15&dir=asc",
    );
  });
});

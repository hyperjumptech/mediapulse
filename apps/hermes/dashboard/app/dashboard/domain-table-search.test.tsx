import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DomainTableSearch } from "./domain-table-search";

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
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
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

  it("does not render a Search submit button", () => {
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
    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
  });

  it("submits through next/form to the base path with preserved params as hidden inputs", () => {
    // Act
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery="abc"
        pageSize={20}
        sortBy="id"
        sortDir="desc"
        preserveParams={{ sector: "energy" }}
        ariaLabel="Search"
      />,
    );

    // Assert
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("data-action", "/dashboard/mp/tickers");
    expect(form).not.toHaveAttribute("method");
    expect(form.querySelector('input[name="size"]')).toHaveValue("20");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("desc");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("id");
    expect(form.querySelector('input[name="sector"]')).toHaveValue("energy");
    expect(form.querySelector('input[name="q"]')).toHaveValue("abc");
  });

  it("submits the search form on submit event", () => {
    render(
      <DomainTableSearch
        basePath="/dashboard/mp/tickers"
        initialQuery="abc"
        pageSize={15}
        sortDir="asc"
        ariaLabel="Search"
      />,
    );

    const form = screen.getByRole("search");
    expect(() => fireEvent.submit(form)).not.toThrow();
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

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { VariablesSearch } from "./variables-search";

describe("VariablesSearch", () => {
  it("renders a labelled search form", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery=""
        pageSize={15}
        sortBy="key"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("search", { name: "Search variables by key" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search by key" }),
    ).toHaveAttribute("placeholder", "Search by key…");
  });

  it("populates the search input with the initial query", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery="API_"
        pageSize={15}
        sortBy="key"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("searchbox")).toHaveValue("API_");
  });

  it("includes hidden inputs for preserving state", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery=""
        pageSize={25}
        sortBy="created"
        sortDir="desc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form.querySelector('input[name="size"]')).toHaveValue("25");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("created");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("desc");
    expect(form.querySelector('input[name="q"]')).toHaveValue("");
  });

  it("submits through next/form to the variables path without a method override", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery=""
        pageSize={15}
        sortBy="key"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("data-action", "/dashboard/variables");
    expect(form).not.toHaveAttribute("method");
  });

  it("shows a clear search link that keeps page size and sort", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery="API_"
        pageSize={20}
        sortBy="created"
        sortDir="desc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=20&sort=created&dir=desc",
    );
  });

  it("hides the clear search link without an active query", () => {
    // Act
    render(
      <VariablesSearch
        initialQuery=""
        pageSize={15}
        sortBy="key"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.queryByRole("link", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });
});

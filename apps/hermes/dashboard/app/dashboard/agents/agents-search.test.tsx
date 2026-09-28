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

import { AgentsSearch } from "./agents-search";

describe("AgentsSearch", () => {
  it("renders a labelled search form", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery=""
        pageSize={15}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("search", {
        name: "Search agents by ID or description",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", {
        name: "Search by agent ID or description",
      }),
    ).toHaveAttribute("placeholder", "Search by agent ID or description…");
  });

  it("populates the search input with the initial query", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery="test-agent"
        pageSize={15}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("searchbox")).toHaveValue("test-agent");
  });

  it("shows a clear search link that keeps page size and sort", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery="test"
        pageSize={20}
        sortBy="created"
        sortDir="desc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=20&sort=created&dir=desc",
    );
  });

  it("hides the clear search link without an active query", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery="  "
        pageSize={15}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.queryByRole("link", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("includes hidden inputs for preserving state", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery=""
        pageSize={25}
        sortBy="agentVersion"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form.querySelector('input[name="size"]')).toHaveValue("25");
    expect(form.querySelector('input[name="sort"]')).toHaveValue(
      "agentVersion",
    );
    expect(form.querySelector('input[name="dir"]')).toHaveValue("asc");
  });

  it("submits through next/form to the agents path without a method override", () => {
    // Act
    render(
      <AgentsSearch
        initialQuery=""
        pageSize={15}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("data-action", "/dashboard/agents");
    expect(form).not.toHaveAttribute("method");
  });
});

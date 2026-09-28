import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HttpTriggersSearch } from "./http-triggers-search";

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

describe("HttpTriggersSearch", () => {
  it("submits through next/form to the triggers path with preserved list state", () => {
    // Act
    render(
      <HttpTriggersSearch
        initialQuery=""
        pageSize={25}
        sortBy="method"
        sortDir="desc"
      />,
    );

    // Assert
    const form = screen.getByRole("search", {
      name: "Search HTTP triggers by name or description",
    });

    expect(form).toHaveAttribute("data-action", "/dashboard/http-triggers");
    expect(form.querySelector('input[name="size"]')).toHaveValue("25");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("method");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("desc");
    expect(
      screen.getByRole("searchbox", { name: "Search by name or description" }),
    ).toHaveAttribute("name", "q");
    expect(
      screen.getByRole("searchbox", { name: "Search by name or description" }),
    ).toHaveAttribute("placeholder", "Filter HTTP triggers…");
  });

  it("prefills the query and links the clear button to the unfiltered list", () => {
    // Act
    render(
      <HttpTriggersSearch
        initialQuery="webhook"
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("searchbox")).toHaveValue("webhook");
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/http-triggers?page=1&size=15&sort=name&dir=asc",
    );
  });

  it("hides the clear button when no search is active", () => {
    // Act
    render(<HttpTriggersSearch pageSize={15} sortBy="name" sortDir="asc" />);

    // Assert
    expect(
      screen.queryByRole("link", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });
});

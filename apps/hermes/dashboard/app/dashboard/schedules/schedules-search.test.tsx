import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SchedulesSearch } from "./schedules-search";

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

describe("SchedulesSearch", () => {
  it("renders a labelled search landmark with a search input", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery=""
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("search", {
        name: "Search schedules by name or description",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search by name or description" }),
    ).toHaveAttribute("name", "q");
  });

  it("populates search input with initial query", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery="daily"
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByPlaceholderText("Search by name or description…"),
    ).toHaveValue("daily");
  });

  it("links the clear button to the unfiltered list with the current sort", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery="test"
        pageSize={20}
        sortBy="nextRunAt"
        sortDir="desc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=20&sort=nextRunAt&dir=desc",
    );
  });

  it("hides the clear button when no search is active", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery="  "
        pageSize={15}
        sortBy="name"
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
      <SchedulesSearch
        initialQuery=""
        pageSize={25}
        sortBy="enabled"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form.querySelector('input[name="size"]')).toHaveValue("25");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("enabled");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("asc");
  });

  it("submits through next/form to the schedules path without a method override", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery=""
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("data-action", "/dashboard/schedules");
    expect(form).not.toHaveAttribute("method");
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchedulesSearch } from "./schedules-search";

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

describe("SchedulesSearch", () => {
  it("renders search form with role", () => {
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
  });

  it("renders search input", () => {
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
      screen.getByPlaceholderText("Search by name or description…"),
    ).toBeInTheDocument();
  });

  it("renders submit button", () => {
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
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
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

  it("shows clear search link when query is active", () => {
    // Act
    render(
      <SchedulesSearch
        initialQuery="test"
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText("Clear search")).toBeInTheDocument();
  });

  it("hides clear search link when no active query", () => {
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
    expect(screen.queryByText("Clear search")).not.toBeInTheDocument();
  });

  it("constructs correct clear href with sort params", () => {
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
    const clearLink = screen.getByRole("link", { name: /Clear search/i });
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/schedules?size=20&sort=nextRunAt&dir=desc",
    );
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

  it("sets form action to schedules path", () => {
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
    expect(form).toHaveAttribute("action", "/dashboard/schedules");
    expect(form).toHaveAttribute("method", "get");
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariablesSearch } from "./variables-search";

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

describe("VariablesSearch", () => {
  it("renders search form with role", () => {
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
  });

  it("populates search input with initial query", () => {
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
    expect(screen.getByPlaceholderText("Search by key…")).toHaveValue("API_");
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

  it("constructs clear href with sort params when query is active", () => {
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
    const clearLink = screen.getByRole("link", { name: /Clear search/i });
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/variables?size=20&sort=created&dir=desc",
    );
  });

  it("hides clear search link when no active query", () => {
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
    expect(screen.queryByText("Clear search")).not.toBeInTheDocument();
  });
});

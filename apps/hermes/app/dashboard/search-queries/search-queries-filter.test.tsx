import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchQueriesFilter } from "./search-queries-filter";

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

describe("SearchQueriesFilter", () => {
  it("renders filter form with role", () => {
    // Act
    render(<SearchQueriesFilter initialTickerName="" pageSize={15} />);

    // Assert
    expect(
      screen.getByRole("search", {
        name: "Filter search queries by ticker name",
      }),
    ).toBeInTheDocument();
  });

  it("populates input with initial ticker name", () => {
    // Act
    render(<SearchQueriesFilter initialTickerName="Apple" pageSize={15} />);

    // Assert
    expect(screen.getByPlaceholderText("Filter by ticker name...")).toHaveValue(
      "Apple",
    );
  });

  it("shows clear filter link when filter is active", () => {
    // Act
    render(<SearchQueriesFilter initialTickerName="Apple" pageSize={15} />);

    // Assert
    expect(screen.getByText("Clear filter")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filter/i })).toHaveAttribute(
      "href",
      "/dashboard/search-queries?size=15",
    );
  });

  it("hides clear filter link when no active filter", () => {
    // Act
    render(<SearchQueriesFilter initialTickerName="" pageSize={15} />);

    // Assert
    expect(screen.queryByText("Clear filter")).not.toBeInTheDocument();
  });
});

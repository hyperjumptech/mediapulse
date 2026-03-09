import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TickersSearch } from "./tickers-search";

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

describe("TickersSearch", () => {
  it("renders search form with role", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("search", {
        name: "Search tickers by symbol or company name",
      }),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByPlaceholderText("Search by symbol or company name…"),
    ).toBeInTheDocument();
  });

  it("renders submit button", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("populates search input with initial query", () => {
    // Act
    render(
      <TickersSearch
        initialQuery="AAPL"
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByPlaceholderText("Search by symbol or company name…"),
    ).toHaveValue("AAPL");
  });

  it("shows clear search link when query is active", () => {
    // Act
    render(
      <TickersSearch
        initialQuery="test"
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText("Clear search")).toBeInTheDocument();
  });

  it("hides clear search link when no active query", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.queryByText("Clear search")).not.toBeInTheDocument();
  });

  it("constructs correct clear href with sort params", () => {
    // Act
    render(
      <TickersSearch
        initialQuery="test"
        pageSize={20}
        sortBy="created"
        sortDir="desc"
      />,
    );

    // Assert
    const clearLink = screen.getByRole("link", { name: /Clear search/i });
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/tickers?size=20&sort=created&dir=desc",
    );
  });

  it("includes hidden inputs for preserving state", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={25}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");
    expect(form.querySelector('input[name="size"]')).toHaveValue("25");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("name");
    expect(form.querySelector('input[name="dir"]')).toHaveValue("asc");
  });

  it("sets form action to tickers path", () => {
    // Act
    render(
      <TickersSearch
        initialQuery=""
        pageSize={15}
        sortBy="symbol"
        sortDir="asc"
      />,
    );

    // Assert
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/dashboard/tickers");
    expect(form).toHaveAttribute("method", "get");
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationTypesSearch } from "./relation-types-search";

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

describe("RelationTypesSearch", () => {
  it("renders search form", () => {
    // Act
    render(
      <RelationTypesSearch
        initialQuery="ceo"
        pageSize={15}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("search", { name: "Search relation types by name" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Clear search")).toBeInTheDocument();
  });
});

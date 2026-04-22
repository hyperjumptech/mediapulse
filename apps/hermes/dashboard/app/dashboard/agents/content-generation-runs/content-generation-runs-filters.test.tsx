import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentGenerationRunsFilters } from "./content-generation-runs-filters";

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
  Button: ({
    children,
    type,
  }: React.PropsWithChildren<{ type?: "button" | "submit" | "reset" }>) => (
    <button type={type}>{children}</button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: ({
    name,
    defaultValue,
    type,
    id,
    placeholder,
  }: {
    name?: string;
    defaultValue?: string;
    type?: string;
    id?: string;
    placeholder?: string;
  }) => (
    <input
      name={name}
      defaultValue={defaultValue}
      type={type}
      id={id}
      placeholder={placeholder}
    />
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

vi.mock("./use-content-generation-runs-filters", () => ({
  useContentGenerationRunsFilters: (filters: {
    outcome?: string;
    tickerId?: string;
    startTime?: string;
    endTime?: string;
  }) => ({
    hasActiveFilters:
      Boolean(filters.outcome) ||
      Boolean(filters.tickerId) ||
      Boolean(filters.startTime) ||
      Boolean(filters.endTime),
  }),
}));

describe("ContentGenerationRunsFilters", () => {
  it("renders all filter controls", () => {
    // Act
    render(<ContentGenerationRunsFilters />);

    // Assert
    expect(screen.getByLabelText("Outcome")).toBeInTheDocument();
    expect(screen.getByLabelText("Ticker ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("populates filter values from props", () => {
    // Act
    render(
      <ContentGenerationRunsFilters
        outcome="failed"
        tickerId="abc-123"
        startTime="2026-04-01"
        endTime="2026-04-30"
      />,
    );

    // Assert
    const outcomeSelect = screen.getByLabelText("Outcome") as HTMLSelectElement;
    expect(outcomeSelect.value).toBe("failed");
    const tickerInput = screen.getByLabelText("Ticker ID") as HTMLInputElement;
    expect(tickerInput.value).toBe("abc-123");
    const startInput = screen.getByLabelText("Start date") as HTMLInputElement;
    expect(startInput.value).toBe("2026-04-01");
    const endInput = screen.getByLabelText("End date") as HTMLInputElement;
    expect(endInput.value).toBe("2026-04-30");
  });

  it("shows clear filters link when filters are active", () => {
    // Act
    render(<ContentGenerationRunsFilters outcome="failed" />);

    // Assert
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("does not show clear filters link when no filters are active", () => {
    // Act
    render(<ContentGenerationRunsFilters />);

    // Assert
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("clear filters link navigates to base route", () => {
    // Act
    render(<ContentGenerationRunsFilters outcome="success" />);

    // Assert
    const clearLink = screen.getByText("Clear filters").closest("a");
    expect(clearLink).toHaveAttribute(
      "href",
      "/dashboard/agents/content-generation-runs",
    );
  });

  it("form action points to the correct base path", () => {
    // Act
    render(<ContentGenerationRunsFilters />);

    // Assert
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute(
      "action",
      "/dashboard/agents/content-generation-runs",
    );
  });
});

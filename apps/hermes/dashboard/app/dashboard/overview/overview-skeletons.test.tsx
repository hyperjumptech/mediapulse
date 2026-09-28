import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ExecutionStatsSkeleton,
  OverviewListSkeleton,
  OverviewPageSkeleton,
} from "./overview-skeletons";

const countSkeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]').length;

describe("ExecutionStatsSkeleton", () => {
  it("renders four KPI card placeholders", () => {
    // Act
    const { container } = render(<ExecutionStatsSkeleton />);

    // Assert
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(4);
  });
});

describe("OverviewListSkeleton", () => {
  it("renders badge, name, source, and time placeholders per row", () => {
    // Act
    const { container } = render(<OverviewListSkeleton rows={2} />);

    // Assert
    expect(countSkeletons(container)).toBe(8);
  });

  it("omits the badge placeholder when rows have no status", () => {
    // Act
    const { container } = render(
      <OverviewListSkeleton rows={2} withBadge={false} />,
    );

    // Assert
    expect(countSkeletons(container)).toBe(6);
  });
});

describe("OverviewPageSkeleton", () => {
  it("renders the KPI row and the chart card", () => {
    // Act
    const { container } = render(<OverviewPageSkeleton />);

    // Assert
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(5);
  });
});

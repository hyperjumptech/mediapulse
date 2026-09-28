import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ExecutionStatsSkeleton,
  OverviewActivitySkeleton,
  OverviewPageSkeleton,
} from "./overview-skeletons";

const countSkeletons = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]').length;

describe("ExecutionStatsSkeleton", () => {
  it("renders four KPI card placeholders", () => {
    const { container } = render(<ExecutionStatsSkeleton />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(4);
  });
});

describe("OverviewActivitySkeleton", () => {
  it("renders the toolbar and table placeholders", () => {
    const { container } = render(<OverviewActivitySkeleton />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(countSkeletons(container)).toBe(38);
  });
});

describe("OverviewPageSkeleton", () => {
  it("renders the KPI row and the chart card", () => {
    const { container } = render(<OverviewPageSkeleton />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(5);
  });
});

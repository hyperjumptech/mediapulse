import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DetailPageSkeleton,
  FormPageSkeleton,
  ListBodySkeleton,
  ListPageSkeleton,
  SectionSkeleton,
  TableSkeleton,
} from "./page-skeletons";

describe("page skeletons", () => {
  it("renders a table skeleton with a header row and the requested rows", () => {
    // Act
    const { container } = render(<TableSkeleton rows={3} columns={4} />);

    // Assert
    const skeletonCells = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletonCells).toHaveLength(4 * 4);
  });

  it("shapes the detail skeleton like a summary grid of label and value pairs", () => {
    // Act
    const { container } = render(<DetailPageSkeleton />);

    // Assert
    const summarySkeleton = container.querySelector(
      '[data-slot="summary-grid-skeleton"]',
    );

    expect(summarySkeleton).toHaveClass("grid-cols-2", "lg:grid-cols-4");
    expect(
      summarySkeleton?.querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(8);
  });

  it.each([
    ["list page", <ListPageSkeleton key="list" />],
    ["list body", <ListBodySkeleton key="body" />],
    ["section", <SectionSkeleton key="section" />],
    ["detail page", <DetailPageSkeleton key="detail" />],
    ["form page", <FormPageSkeleton key="form" />],
  ])("announces the %s skeleton as loading", (_label, skeleton) => {
    // Act
    render(skeleton);

    // Assert
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});

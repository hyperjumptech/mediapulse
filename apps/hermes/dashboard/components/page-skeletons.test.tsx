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

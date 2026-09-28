import React from "react";
import Link from "next/link";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryGrid, SummaryItem } from "./summary-grid";

describe("SummaryGrid", () => {
  it("renders items as a definition list with muted labels", () => {
    // Act
    const { container } = render(
      <SummaryGrid>
        <SummaryItem label="Pipeline">Daily digest</SummaryItem>
        <SummaryItem label="Timezone">UTC</SummaryItem>
      </SummaryGrid>,
    );

    // Assert
    const grid = container.querySelector("dl");
    const labels = within(grid as HTMLElement).getAllByRole("term");
    const values = within(grid as HTMLElement).getAllByRole("definition");

    expect(labels.map((label) => label.textContent)).toEqual([
      "Pipeline",
      "Timezone",
    ]);
    expect(values.map((value) => value.textContent)).toEqual([
      "Daily digest",
      "UTC",
    ]);
    expect(labels[0]).toHaveClass("text-xs", "text-muted-foreground");
    expect(values[0]).toHaveClass("text-sm");
  });

  it("lays out two columns on mobile and four on large screens", () => {
    // Act
    const { container } = render(
      <SummaryGrid>
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    // Assert
    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-3", "lg:grid-cols-4");
  });

  it("merges a custom className onto the grid", () => {
    // Act
    const { container } = render(
      <SummaryGrid className="summary-extra">
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    // Assert
    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveClass("summary-extra", "grid");
  });

  it("spans two columns for wide items", () => {
    // Act
    render(
      <SummaryGrid>
        <SummaryItem label="Invoke URL" wide>
          https://hermes.example.com/api/http-triggers/t-1/invoke
        </SummaryItem>
        <SummaryItem label="Method" className="item-extra">
          POST
        </SummaryItem>
      </SummaryGrid>,
    );

    // Assert
    const wideItem = screen.getByText("Invoke URL").parentElement;
    const narrowItem = screen.getByText("Method").parentElement;

    expect(wideItem).toHaveClass("col-span-2");
    expect(narrowItem).not.toHaveClass("col-span-2");
    expect(narrowItem).toHaveClass("item-extra");
  });

  it("renders rich value content", () => {
    // Act
    render(
      <SummaryGrid>
        <SummaryItem label="Pipeline">
          <Link href="/dashboard/pipelines/p-1">Daily digest</Link>
        </SummaryItem>
      </SummaryGrid>,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Daily digest" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/p-1",
    );
  });
});

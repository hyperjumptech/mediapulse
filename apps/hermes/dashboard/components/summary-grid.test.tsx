import React from "react";
import Link from "next/link";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryGrid, SummaryItem } from "./summary-grid";

describe("SummaryGrid", () => {
  it("renders items as a definition list with muted labels", () => {
    const { container } = render(
      <SummaryGrid>
        <SummaryItem label="Pipeline">Daily digest</SummaryItem>
        <SummaryItem label="Timezone">UTC</SummaryItem>
      </SummaryGrid>,
    );

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
    expect(labels[0]).not.toHaveClass("uppercase");
    expect(values[0]).toHaveClass("text-sm");
  });

  it("lays out one column on phones and two from sm", () => {
    const { container } = render(
      <SummaryGrid>
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    expect(grid).not.toHaveClass("grid-cols-2");
  });

  it("draws a card around the grid by default", () => {
    const { container } = render(
      <SummaryGrid>
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveAttribute("data-variant", "card");
    expect(grid).toHaveClass("rounded-lg", "border", "bg-card");
  });

  it("drops the card chrome in the plain variant", () => {
    const { container } = render(
      <SummaryGrid variant="plain">
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveAttribute("data-variant", "plain");
    expect(grid).toHaveClass("grid", "grid-cols-1", "sm:grid-cols-2");
    expect(grid).not.toHaveClass("border");
    expect(grid).not.toHaveClass("bg-card");
  });

  it("merges a custom className onto the grid", () => {
    const { container } = render(
      <SummaryGrid className="summary-extra">
        <SummaryItem label="Method">POST</SummaryItem>
      </SummaryGrid>,
    );

    const grid = container.querySelector('[data-slot="summary-grid"]');

    expect(grid).toHaveClass("summary-extra", "grid");
  });

  it("spans the full row for wide items at every width", () => {
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

    const wideItem = screen.getByText("Invoke URL").parentElement;
    const narrowItem = screen.getByText("Method").parentElement;

    expect(wideItem).toHaveClass("col-span-full");
    expect(wideItem).not.toHaveClass("col-span-2");
    expect(narrowItem).not.toHaveClass("col-span-full");
    expect(narrowItem).toHaveClass("item-extra");
  });

  it("lets values shrink and wrap between words", () => {
    render(
      <SummaryGrid>
        <SummaryItem label="Description">
          A long sentence that wraps
        </SummaryItem>
      </SummaryGrid>,
    );

    const value = screen.getByRole("definition");

    expect(value).toHaveClass("min-w-0", "break-words");
    expect(value).not.toHaveClass("break-all");
  });

  it("breaks long ids anywhere when breakAll is set", () => {
    render(
      <SummaryGrid>
        <SummaryItem label="Registry ID" breakAll>
          3f1c9a52-7d0e-4b8a-9f3e-2c6d1b0a8e47
        </SummaryItem>
      </SummaryGrid>,
    );

    const value = screen.getByRole("definition");

    expect(value).toHaveClass("min-w-0", "break-all");
    expect(value).not.toHaveClass("break-words");
  });

  it("renders rich value content", () => {
    render(
      <SummaryGrid>
        <SummaryItem label="Pipeline">
          <Link href="/dashboard/pipelines/p-1">Daily digest</Link>
        </SummaryItem>
      </SummaryGrid>,
    );

    expect(screen.getByRole("link", { name: "Daily digest" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/p-1",
    );
  });
});

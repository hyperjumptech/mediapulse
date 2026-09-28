import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StepExecutionSummary } from "@/lib/execution-summary";

import { ExecutionPipelineStepsTable } from "./execution-pipeline-steps-table";

const buildStep = (
  overrides: Partial<StepExecutionSummary> = {},
): StepExecutionSummary => ({
  pipelineStepId: "step-1",
  stepOrder: 1,
  agentId: "summarizer",
  agentVersion: "1.2.0",
  expectedInvocationCount: 4,
  succeededCount: 3,
  failedCount: 1,
  rollupStatus: "partial",
  ...overrides,
});

const desktopTable = () => within(screen.getByRole("table"));

const mobileCards = () => {
  const list = document.querySelector<HTMLElement>(
    '[data-slot="data-table-mobile-list"]',
  );
  if (!list) {
    throw new Error("Missing mobile list");
  }

  return within(list);
};

describe("ExecutionPipelineStepsTable", () => {
  it("renders one desktop row per step with its counts", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    const headers = desktopTable()
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    const [, row] = desktopTable().getAllByRole("row");
    const cellTexts = within(row as HTMLElement)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

    expect(headers).toEqual([
      "Order",
      "Agent",
      "Rollup",
      "OK",
      "Failed",
      "Expected",
    ]);
    expect(cellTexts).toEqual([
      "1",
      "summarizer@1.2.0",
      "partial",
      "3",
      "1",
      "4",
    ]);
  });

  it("highlights failed invocations only when some failed", () => {
    render(
      <ExecutionPipelineStepsTable
        steps={[
          buildStep(),
          buildStep({
            pipelineStepId: "step-2",
            stepOrder: 2,
            agentId: "publisher",
            failedCount: 0,
          }),
        ]}
      />,
    );

    const [, failingRow, passingRow] = desktopTable().getAllByRole("row");
    const failingCount = within(failingRow as HTMLElement).getAllByRole(
      "cell",
    )[4]?.firstElementChild;
    const passingCount = within(passingRow as HTMLElement).getAllByRole(
      "cell",
    )[4]?.firstElementChild;

    expect(failingCount).toHaveClass("text-destructive");
    expect(passingCount).toHaveClass("text-muted-foreground");
    expect(passingCount).not.toHaveClass("text-destructive");
  });

  it("stacks each step as a phone card titled by its agent", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    const [card] = mobileCards().getAllByRole("listitem");
    const cardQueries = within(card as HTMLElement);
    const labels = cardQueries
      .getAllByRole("term")
      .map((label) => label.textContent);

    expect(cardQueries.getByText("summarizer@1.2.0")).toBeInTheDocument();
    expect(cardQueries.getByText("partial")).toBeInTheDocument();
    expect(labels).toEqual(["Order", "OK", "Failed", "Expected"]);
  });

  it("explains when no pipeline steps ran", () => {
    render(<ExecutionPipelineStepsTable steps={[]} />);

    expect(screen.getByText("No pipeline steps ran")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nothing was enqueued for this execution, so no step rollups were recorded.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers no column menu", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    expect(
      screen.queryByRole("button", { name: "Customize columns" }),
    ).not.toBeInTheDocument();
  });
});

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
  sourcePipelineName: null,
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
  it("titles the section with the step count", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    expect(
      screen.getByRole("heading", { name: "Pipeline steps" }).parentElement,
    ).toHaveTextContent("Pipeline steps1");
  });

  it("numbers steps from one in the order they ran", () => {
    render(
      <ExecutionPipelineStepsTable
        steps={[
          buildStep({ stepOrder: 0 }),
          buildStep({ pipelineStepId: "step-2", stepOrder: 1 }),
        ]}
      />,
    );

    const positions = desktopTable()
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

    expect(positions).toEqual(["1", "2"]);
  });

  it("renders one desktop row per step with its counts", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    const headers = desktopTable()
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    const [, row] = desktopTable().getAllByRole("row");
    const cellTexts = within(row as HTMLElement)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

    expect(headers).toEqual(["#", "Agent", "Status", "Succeeded", "Failed"]);
    expect(cellTexts).toEqual([
      "1",
      "summarizer@1.2.0",
      "partial",
      "3 / 4",
      "1",
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
    expect(labels).toEqual(["Succeeded", "Failed"]);
  });

  it("explains when no pipeline steps ran", () => {
    render(<ExecutionPipelineStepsTable steps={[]} />);

    expect(screen.getByText("No pipeline steps ran")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing was enqueued for this execution."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers no column menu", () => {
    render(<ExecutionPipelineStepsTable steps={[buildStep()]} />);

    expect(
      screen.queryByRole("button", { name: "Customize columns" }),
    ).not.toBeInTheDocument();
  });

  it("prefixes steps inlined from another pipeline with that pipeline's name", () => {
    render(
      <ExecutionPipelineStepsTable
        steps={[buildStep({ sourcePipelineName: "Data Collection" })]}
      />,
    );

    expect(
      desktopTable().getByText("Data Collection › summarizer@1.2.0"),
    ).toBeVisible();
  });
});

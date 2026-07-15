/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { DetailBlockStatCardsView } from "./detail-block-stat-cards";

const renderWithTooltip = (ui: ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("DetailBlockStatCardsView", () => {
  it("renders one card per entry with its label and value", () => {
    renderWithTooltip(
      <DetailBlockStatCardsView
        block={{
          type: "statCards",
          label: "Query Generation Stage",
          cards: [
            { label: "Agent", field: "stage.agentLabel" },
            { label: "LLM Model", field: "stage.model" },
          ],
        }}
        data={{ stage: { agentLabel: "query-analysis - 3.0.0", model: "gpt" } }}
      />,
    );

    expect(screen.getByText("Query Generation Stage")).toBeInTheDocument();
    expect(screen.getByText("query-analysis - 3.0.0")).toBeInTheDocument();
    expect(screen.getByText("gpt")).toBeInTheDocument();
  });

  it("renders a help-icon hint carrying the breakdown when tooltipField resolves", () => {
    renderWithTooltip(
      <DetailBlockStatCardsView
        block={{
          type: "statCards",
          label: "Stage",
          cards: [
            {
              label: "LLM Tokens",
              field: "stage.total",
              tooltipField: "stage.breakdown",
            },
          ],
        }}
        data={{
          stage: {
            total: "1.8K",
            breakdown: "Input 1,234 · Output 567 · Reasoning 8",
          },
        }}
      />,
    );

    expect(screen.getByText("1.8K")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "LLM Tokens breakdown" }),
    ).toBeInTheDocument();
  });

  it("omits the help icon when no tooltipField is set", () => {
    renderWithTooltip(
      <DetailBlockStatCardsView
        block={{
          type: "statCards",
          label: "Stage",
          cards: [{ label: "Agent", field: "stage.agentLabel" }],
        }}
        data={{ stage: { agentLabel: "query-analysis" } }}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("colors the card value from colorField", () => {
    renderWithTooltip(
      <DetailBlockStatCardsView
        block={{
          type: "statCards",
          label: "Delivery Stage",
          cards: [
            {
              label: "Outcome",
              field: "delivery.outcomeLabel",
              colorField: "delivery.outcomeVariant",
            },
          ],
        }}
        data={{
          delivery: { outcomeLabel: "Success", outcomeVariant: "success" },
        }}
      />,
    );

    expect(screen.getByText("Success").className).toContain("text-green-600");
  });
});

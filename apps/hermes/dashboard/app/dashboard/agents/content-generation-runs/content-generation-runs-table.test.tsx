import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContentGenerationRunListItem } from "@workspace/agent-data-api-contract";
import { ContentGenerationRunsTable } from "./content-generation-runs-table";

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => (
    <table data-testid="table">{children}</table>
  ),
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
    className,
  }: React.PropsWithChildren<{ colSpan?: number; className?: string }>) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
}));

vi.mock("@/components/agent-run-outcome-badge", () => ({
  AgentRunOutcomeBadge: ({ outcome }: { outcome: string }) => (
    <span data-testid="outcome-badge" data-outcome={outcome}>
      {outcome}
    </span>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const makeRun = (
  overrides: Partial<ContentGenerationRunListItem> = {},
): ContentGenerationRunListItem => ({
  id: "00000000-0000-4000-a000-000000000001",
  agentId: "content-generation",
  agentVersion: "1.0.0",
  tickerId: "11111111-1111-4111-a111-111111111111",
  outcome: "success",
  stage: "llm",
  errorCode: null,
  errorCategory: null,
  message: null,
  durationMs: 1200,
  pipelineRunId: null,
  newsletterId: null,
  createdAt: "2026-04-15T10:30:00.000Z",
  ...overrides,
});

describe("ContentGenerationRunsTable", () => {
  it("renders empty state when no runs provided", () => {
    // Act
    render(<ContentGenerationRunsTable runs={[]} />);

    // Assert
    expect(
      screen.getByText(
        "No content-generation runs found matching the current filters.",
      ),
    ).toBeInTheDocument();
  });

  it("renders table rows for each run", () => {
    // Setup
    const runs = [
      makeRun({
        id: "00000000-0000-4000-a000-000000000001",
        outcome: "success",
        stage: "llm",
        durationMs: 1200,
        createdAt: "2026-04-15T10:30:00.000Z",
      }),
      makeRun({
        id: "00000000-0000-4000-a000-000000000002",
        outcome: "failed",
        stage: "precheck",
        errorCode: "TICKER_NOT_FOUND",
        durationMs: 50,
        createdAt: "2026-04-14T08:00:00.000Z",
      }),
    ];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getAllByTestId("outcome-badge")).toHaveLength(2);
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("renders dash for null stage", () => {
    // Setup — errorCode has a value so only stage renders dash
    const runs = [makeRun({ stage: null, errorCode: "ERR", durationMs: 100 })];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders formatted duration in ms", () => {
    // Setup
    const runs = [makeRun({ durationMs: 3400 })];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getByText("3.4s")).toBeInTheDocument();
  });

  it("renders dash for null durationMs", () => {
    // Setup — only durationMs is null, stage and errorCode have values
    const runs = [
      makeRun({ durationMs: null, errorCode: "ERR", stage: "llm" }),
    ];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders dash for null errorCode", () => {
    // Setup — only errorCode is null, stage and durationMs have values
    const runs = [makeRun({ errorCode: null, stage: "llm", durationMs: 100 })];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders errorCode when present", () => {
    // Setup
    const runs = [makeRun({ errorCode: "TIMEOUT" })];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
  });

  it("links each row to the detail page", () => {
    // Setup
    const runs = [makeRun({ id: "aaa-bbb-ccc" })];

    // Act
    render(<ContentGenerationRunsTable runs={runs} />);

    // Assert
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/agents/content-generation-runs/aaa-bbb-ccc",
    );
  });
});

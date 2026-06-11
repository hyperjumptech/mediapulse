import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContentGenerationRunListItem } from "@workspace/agent-data-api-contract";
import { ContentGenerationRunDetail } from "./content-generation-run-detail";

vi.mock("@/components/agent-run-outcome-badge", () => ({
  AgentRunOutcomeBadge: ({ outcome }: { outcome: string }) => (
    <span data-testid="outcome-badge" data-outcome={outcome}>
      {outcome}
    </span>
  ),
}));

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copy: vi.fn(),
  }),
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

describe("ContentGenerationRunDetail", () => {
  it("renders all field labels", () => {
    // Setup
    const run = makeRun();

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Agent ID")).toBeInTheDocument();
    expect(screen.getByText("Agent version")).toBeInTheDocument();
    expect(screen.getByText("Ticker ID")).toBeInTheDocument();
    expect(screen.getByText("Stage")).toBeInTheDocument();
    expect(screen.getByText("Error code")).toBeInTheDocument();
    expect(screen.getByText("Error category")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Pipeline run ID")).toBeInTheDocument();
    expect(screen.getByText("Newsletter ID")).toBeInTheDocument();
    expect(screen.getByText("Created at")).toBeInTheDocument();
  });

  it("renders run field values", () => {
    // Setup
    const run = makeRun({
      id: "aaa-bbb-ccc",
      agentId: "content-generation",
      agentVersion: "2.0.0",
      stage: "persist",
      errorCode: "TIMEOUT",
      errorCategory: "transient",
      message: "Request timed out after 30s",
      durationMs: 30000,
      pipelineRunId: "pipe-001",
    });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    expect(screen.getByText("aaa-bbb-ccc")).toBeInTheDocument();
    expect(screen.getByText("2.0.0")).toBeInTheDocument();
    expect(screen.getByText("persist")).toBeInTheDocument();
    expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("transient")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByText("pipe-001")).toBeInTheDocument();
  });

  it("renders message in a pre block when present", () => {
    // Setup
    const run = makeRun({ message: "Error details here" });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    expect(screen.getByText("Error details here")).toBeInTheDocument();
  });

  it("renders dash for null fields", () => {
    // Setup
    const run = makeRun({
      stage: null,
      errorCode: null,
      errorCategory: null,
      message: null,
      durationMs: null,
      pipelineRunId: null,
      newsletterId: null,
    });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert — all null fields render dash
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it("renders newsletterId with copy button when present", () => {
    // Setup
    const run = makeRun({
      newsletterId: "22222222-2222-4222-a222-222222222222",
    });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    expect(
      screen.getByText("22222222-2222-4222-a222-222222222222"),
    ).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("renders dash for null newsletterId", () => {
    // Setup
    const run = makeRun({ newsletterId: null });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders back link to list page", () => {
    // Setup
    const run = makeRun();

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    const backLink = screen.getByText(/Back to content-generation runs/);
    expect(backLink.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/agents/content-generation-runs",
    );
  });

  it("renders outcome badge", () => {
    // Setup
    const run = makeRun({ outcome: "failed" });

    // Act
    render(<ContentGenerationRunDetail run={run} />);

    // Assert
    const badge = screen.getByTestId("outcome-badge");
    expect(badge).toHaveAttribute("data-outcome", "failed");
  });
});

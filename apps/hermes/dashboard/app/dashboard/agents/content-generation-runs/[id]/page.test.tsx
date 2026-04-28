import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const getRunsMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL:
      "postgresql://mediapulse:mediapulse@localhost:5432/mediapulse",
    TEMP_ADMIN_USERNAME: "test",
    TEMP_ADMIN_PASSWORD: "testtest",
    HERMES_INTERNAL_API_KEY: "test-key",
    AGENT_DATA_API_URL: "http://test-agent-data-api",
    HERMES_CGA_DIAGNOSTICS_ENABLED: "true",
  },
}));

vi.mock("@/lib/agent-data-api-client", () => ({
  getDashboardAgentDataApiClient: () => ({
    contentGenerationRuns: {
      get: (...args: unknown[]) => getRunsMock(...args),
    },
  }),
}));

vi.mock("./content-generation-run-detail", () => ({
  ContentGenerationRunDetail: ({
    run,
  }: {
    run: { id: string; outcome: string };
  }) => (
    <div data-testid="run-detail" data-id={run.id} data-outcome={run.outcome}>
      Detail
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import ContentGenerationRunDetailPage from "./page";

describe("ContentGenerationRunDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    getRunsMock.mockReset();
  });

  it("renders detail view when run is found", async () => {
    // Setup
    getRunsMock.mockResolvedValue({
      data: [
        {
          id: "run-001",
          outcome: "success",
          agentId: "content-generation",
          agentVersion: "1.0.0",
          tickerId: "11111111-1111-4111-a111-111111111111",
          stage: "llm",
          errorCode: null,
          errorCategory: null,
          message: null,
          durationMs: 1200,
          pipelineRunId: null,
          newsletterId: null,
          createdAt: "2026-04-15T10:30:00.000Z",
        },
      ],
    });

    // Act
    const component = await ContentGenerationRunDetailPage({
      params: { id: "run-001" },
    });
    render(component);

    // Assert
    expect(screen.getByTestId("run-detail")).toBeInTheDocument();
    expect(screen.getByTestId("run-detail")).toHaveAttribute(
      "data-id",
      "run-001",
    );
  });

  it("calls notFound when run is not found in response", async () => {
    // Setup
    const { notFound } = await import("next/navigation");
    getRunsMock.mockResolvedValue({
      data: [
        {
          id: "different-id",
          outcome: "failed",
        },
      ],
    });

    // Act
    await ContentGenerationRunDetailPage({
      params: { id: "run-999" },
    });

    // Assert
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound when SDK call throws", async () => {
    // Setup
    const { notFound } = await import("next/navigation");
    getRunsMock.mockRejectedValue(new Error("API error"));

    // Act
    await ContentGenerationRunDetailPage({
      params: { id: "run-001" },
    });

    // Assert
    expect(notFound).toHaveBeenCalled();
  });
});

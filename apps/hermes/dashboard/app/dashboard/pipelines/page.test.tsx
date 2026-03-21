import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelinesWithStepsMock = vi.fn();
const getPipelinesValidationMapMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: () => getPipelinesValidationMapMock(),
}));

vi.mock("@workspace/orchestration-database", () => ({
  prisma: {},
}));

vi.mock("./pipelines-with-modal", () => ({
  PipelinesWithModal: ({
    pipelines,
  }: {
    pipelines: Array<{ id: string; name: string }>;
  }) => (
    <div data-testid="pipelines-with-modal" data-count={pipelines.length}>
      Pipelines
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import PipelinesPage from "./page";

describe("PipelinesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getPipelinesWithStepsMock.mockReset();
    getPipelinesValidationMapMock.mockReset();
  });

  it("renders pipelines with modal when authenticated", async () => {
    // Setup
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "1", name: "Test Pipeline", steps: [] },
    ]);
    getPipelinesValidationMapMock.mockResolvedValue({});

    // Act
    const component = await PipelinesPage({});
    render(component);

    // Assert
    expect(screen.getByTestId("pipelines-with-modal")).toBeInTheDocument();
    expect(screen.getByTestId("pipelines-with-modal")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders empty state when no pipelines", async () => {
    // Setup
    getPipelinesWithStepsMock.mockResolvedValue([]);
    getPipelinesValidationMapMock.mockResolvedValue({});

    // Act
    const component = await PipelinesPage({});
    render(component);

    // Assert
    expect(screen.getByTestId("pipelines-with-modal")).toHaveAttribute(
      "data-count",
      "0",
    );
  });
});

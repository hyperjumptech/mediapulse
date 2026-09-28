import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelinesWithStepsMock = vi.fn();
const getPipelinesValidationMapMock = vi.fn();

const { findManyDomainIntegrations } = vi.hoisted(() => ({
  findManyDomainIntegrations: vi.fn(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: (...args: unknown[]) =>
    getPipelinesValidationMapMock(...args),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    domainIntegration: {
      findMany: findManyDomainIntegrations,
    },
  },
}));

vi.mock("./pipelines-with-modal", () => ({
  PipelinesWithModal: ({
    pipelines,
    domainIntegrations,
  }: {
    pipelines: Array<{ id: string; name: string }>;
    domainIntegrations: unknown[];
  }) => (
    <div
      data-testid="pipelines-with-modal"
      data-count={pipelines.length}
      data-domain-count={domainIntegrations.length}
    >
      Pipelines
    </div>
  ),
}));

import { PipelinesSection } from "./pipelines-section";

describe("PipelinesSection", () => {
  afterEach(() => {
    getPipelinesWithStepsMock.mockReset();
    getPipelinesValidationMapMock.mockReset();
    findManyDomainIntegrations.mockReset();
  });

  it("renders pipelines with modal and domain integrations", async () => {
    // Setup
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "1", name: "Test Pipeline", steps: [] },
    ]);
    getPipelinesValidationMapMock.mockResolvedValue({});
    findManyDomainIntegrations.mockResolvedValue([
      { id: "integration-1", integrationId: "mediapulse", name: "Mediapulse" },
    ]);

    // Act
    render(await PipelinesSection());

    // Assert
    const table = screen.getByTestId("pipelines-with-modal");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-domain-count", "1");
    expect(findManyDomainIntegrations).toHaveBeenCalledWith({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    });
  });

  it("renders empty state when no pipelines", async () => {
    // Setup
    getPipelinesWithStepsMock.mockResolvedValue([]);
    getPipelinesValidationMapMock.mockResolvedValue({});
    findManyDomainIntegrations.mockResolvedValue([]);

    // Act
    render(await PipelinesSection());

    // Assert
    const table = screen.getByTestId("pipelines-with-modal");

    expect(table).toHaveAttribute("data-count", "0");
    expect(table).toHaveAttribute("data-domain-count", "0");
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPipelineSummariesWithValidationMock = vi.fn();

const { findManyDomainIntegrations } = vi.hoisted(() => ({
  findManyDomainIntegrations: vi.fn(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/pipeline-summaries", () => ({
  getPipelineSummariesWithValidation: () =>
    getPipelineSummariesWithValidationMock(),
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
    pipelineValidationById,
    domainIntegrations,
  }: {
    pipelines: Array<{ id: string; name: string }>;
    pipelineValidationById: Record<string, { valid: boolean }>;
    domainIntegrations: unknown[];
  }) => (
    <div
      data-testid="pipelines-with-modal"
      data-count={pipelines.length}
      data-validation-keys={Object.keys(pipelineValidationById).join(",")}
      data-domain-count={domainIntegrations.length}
    >
      Pipelines
    </div>
  ),
}));

import { PipelinesSection } from "./pipelines-section";

describe("PipelinesSection", () => {
  afterEach(() => {
    getPipelineSummariesWithValidationMock.mockReset();
    findManyDomainIntegrations.mockReset();
  });

  it("renders pipelines with modal and domain integrations", async () => {
    // Setup
    getPipelineSummariesWithValidationMock.mockResolvedValue({
      pipelines: [
        {
          id: "1",
          name: "Test Pipeline",
          description: null,
          isActive: true,
          createdById: null,
          createdBy: null,
        },
      ],
      pipelineValidationById: { "1": { valid: true, warnings: [] } },
    });
    findManyDomainIntegrations.mockResolvedValue([
      { id: "integration-1", integrationId: "mediapulse", name: "Mediapulse" },
    ]);

    // Act
    render(await PipelinesSection());

    // Assert
    const table = screen.getByTestId("pipelines-with-modal");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-validation-keys", "1");
    expect(table).toHaveAttribute("data-domain-count", "1");
    expect(findManyDomainIntegrations).toHaveBeenCalledWith({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: { id: true, integrationId: true, name: true },
    });
  });

  it("renders empty state when no pipelines", async () => {
    // Setup
    getPipelineSummariesWithValidationMock.mockResolvedValue({
      pipelines: [],
      pipelineValidationById: {},
    });
    findManyDomainIntegrations.mockResolvedValue([]);

    // Act
    render(await PipelinesSection());

    // Assert
    const table = screen.getByTestId("pipelines-with-modal");

    expect(table).toHaveAttribute("data-count", "0");
    expect(table).toHaveAttribute("data-domain-count", "0");
  });
});

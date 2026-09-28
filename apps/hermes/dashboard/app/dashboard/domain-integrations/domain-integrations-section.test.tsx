import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { findManyDomainIntegrations } = vi.hoisted(() => ({
  findManyDomainIntegrations: vi.fn(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    domainIntegration: {
      findMany: findManyDomainIntegrations,
    },
  },
}));

vi.mock("./domain-integration-row-actions", () => ({
  DomainIntegrationRowActions: ({
    row,
  }: {
    row: { id: string; integrationId: string; name: string };
  }) => (
    <div
      data-testid={`domain-integration-row-actions-${row.id}`}
      data-integration-id={row.integrationId}
    />
  ),
}));

import { DomainIntegrationsSection } from "./domain-integrations-section";

describe("DomainIntegrationsSection", () => {
  afterEach(() => {
    findManyDomainIntegrations.mockReset();
  });

  it("renders each integration with its status and creator", async () => {
    // Setup
    findManyDomainIntegrations.mockResolvedValue([
      {
        id: "integration-1",
        integrationId: "mediapulse",
        name: "Mediapulse",
        status: "active",
        baseUrl: "https://mediapulse.example.com",
        createdById: "user-1",
        createdBy: { id: "user-1", name: "Ada", email: "ada@example.com" },
      },
      {
        id: "integration-2",
        integrationId: "sandbox",
        name: "Sandbox",
        status: "pending",
        baseUrl: null,
        createdById: null,
        createdBy: null,
      },
    ]);

    // Act
    render(await DomainIntegrationsSection());

    // Assert
    expect(screen.getByText("mediapulse")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(
      screen.getByText("https://mediapulse.example.com"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(
      screen.getByTestId("domain-integration-row-actions-integration-2"),
    ).toHaveAttribute("data-integration-id", "sandbox");
    expect(findManyDomainIntegrations).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      }),
    );
  });

  it("renders the empty state when there are no integrations", async () => {
    // Setup
    findManyDomainIntegrations.mockResolvedValue([]);

    // Act
    render(await DomainIntegrationsSection());

    // Assert
    expect(
      screen.getByText("No integrations yet. Create one to get an API key."),
    ).toBeInTheDocument();
  });
});

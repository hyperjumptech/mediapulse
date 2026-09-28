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

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ baseUrl: false }),
}));

vi.mock("./domain-integrations-table", () => ({
  DomainIntegrationsTable: ({
    integrations,
    initialColumnVisibility,
  }: {
    integrations: Array<{ id: string }>;
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="domain-integrations-table"
      data-ids={integrations.map((integration) => integration.id).join(",")}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
  ),
}));

import { DomainIntegrationsSection } from "./domain-integrations-section";

describe("DomainIntegrationsSection", () => {
  afterEach(() => {
    findManyDomainIntegrations.mockReset();
  });

  it("hands the table its integrations and saved column choices", async () => {
    findManyDomainIntegrations.mockResolvedValue([
      {
        id: "integration-1",
        integrationId: "mediapulse",
        name: "Mediapulse",
        status: "active",
        baseUrl: "https://mediapulse.example.com",
      },
      {
        id: "integration-2",
        integrationId: "sandbox",
        name: "Sandbox",
        status: "pending",
        baseUrl: null,
      },
    ]);

    render(await DomainIntegrationsSection());

    const table = screen.getByTestId("domain-integrations-table");

    expect(table).toHaveAttribute("data-ids", "integration-1,integration-2");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ baseUrl: false }),
    );
  });

  it("loads integrations default first without the creator", async () => {
    findManyDomainIntegrations.mockResolvedValue([]);

    render(await DomainIntegrationsSection());

    expect(findManyDomainIntegrations).toHaveBeenCalledWith({
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: {
        id: true,
        integrationId: true,
        name: true,
        status: true,
        baseUrl: true,
      },
    });
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchAgentTabContentsMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/domain-content-view", () => ({
  fetchAgentTabContents: (...args: unknown[]) =>
    fetchAgentTabContentsMock(...args),
}));

vi.mock("./agent-details-content", () => ({
  AgentDetailsContent: ({
    agent,
    agentTabContents = [],
    agentTabContentsError,
  }: {
    agent: { agentId: string };
    agentTabContents?: Array<{ view: { id: string } }>;
    agentTabContentsError?: string;
  }) => (
    <div
      data-testid="agent-details-content"
      data-agent-id={agent.agentId}
      data-tab-ids={agentTabContents
        .map((tabContent) => tabContent.view.id)
        .join(",")}
      data-error={agentTabContentsError ?? ""}
    />
  ),
}));

import { AgentTabContentsSection } from "./agent-tab-contents-section";

const createMockAgent = () => ({
  id: "agent-uuid-1",
  domainIntegrationId: "di-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test",
  endpoint: {},
  inputSchema: null,
  configSchema: null,
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  domainIntegration: { integrationId: "acme-local" },
});

describe("AgentTabContentsSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchAgentTabContentsMock.mockReset();
  });

  it("renders the agent details with the fetched domain tabs", async () => {
    // Setup
    fetchAgentTabContentsMock.mockResolvedValue([
      {
        view: { id: "operator-agent-insights", kind: "html" },
        content: { body: "<p>Insights</p>" },
      },
    ]);

    // Act
    render(await AgentTabContentsSection({ agent: createMockAgent() }));

    // Assert
    const content = screen.getByTestId("agent-details-content");

    expect(fetchAgentTabContentsMock).toHaveBeenCalledWith(
      "acme-local",
      "test-agent",
    );
    expect(content).toHaveAttribute("data-agent-id", "test-agent");
    expect(content).toHaveAttribute("data-tab-ids", "operator-agent-insights");
    expect(content).toHaveAttribute("data-error", "");
  });

  it("renders the agent details with an inline error when the tabs fail to load", async () => {
    // Setup
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    fetchAgentTabContentsMock.mockRejectedValue(
      new Error("Domain content view failed (502): Bad Gateway"),
    );

    // Act
    render(await AgentTabContentsSection({ agent: createMockAgent() }));

    // Assert
    const content = screen.getByTestId("agent-details-content");

    expect(content).toHaveAttribute("data-tab-ids", "");
    expect(content).toHaveAttribute(
      "data-error",
      "Could not load integration tabs for this agent.",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

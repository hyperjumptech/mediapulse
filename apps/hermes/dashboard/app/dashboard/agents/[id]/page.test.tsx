import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentByIdMock = vi.fn();
const notFoundMock = vi.fn();
const sectionState = { suspended: false };
const pendingTabContents = new Promise<never>(() => undefined);

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/agents", () => ({
  getAgentById: (...args: unknown[]) => getAgentByIdMock(...args),
}));

vi.mock("./agent-tab-contents-section", () => ({
  AgentTabContentsSection: ({
    agent,
  }: {
    agent: { agentId: string; agentVersion: string };
  }) => {
    if (sectionState.suspended) {
      React.use(pendingTabContents);
    }

    return (
      <div
        data-testid="agent-tab-contents-section"
        data-agent-id={agent.agentId}
        data-agent-version={agent.agentVersion}
      />
    );
  },
}));

vi.mock("./agent-details-content", () => ({
  AgentDetailsContent: ({
    agent,
  }: {
    agent: { agentId: string; agentVersion: string };
  }) => (
    <div
      data-testid="agent-details-content"
      data-agent-id={agent.agentId}
      data-agent-version={agent.agentVersion}
    >
      Agent details
    </div>
  ),
}));

import AgentDetailPage from "./page";

const createMockAgent = () => ({
  id: "agent-uuid-1",
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

describe("AgentDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getAgentByIdMock.mockReset();
    notFoundMock.mockReset();
    sectionState.suspended = false;
  });

  it("renders the agent tab contents section for the loaded agent", async () => {
    // Setup
    getAgentByIdMock.mockResolvedValue(createMockAgent());

    // Act
    const component = await AgentDetailPage({
      params: Promise.resolve({ id: "agent-uuid-1" }),
    });
    render(component);

    // Assert
    const section = screen.getByTestId("agent-tab-contents-section");

    expect(getAgentByIdMock).toHaveBeenCalledWith("agent-uuid-1");
    expect(section).toHaveAttribute("data-agent-id", "test-agent");
    expect(section).toHaveAttribute("data-agent-version", "1.0");
  });

  it("renders the agent details while the tab contents are loading", async () => {
    // Setup
    getAgentByIdMock.mockResolvedValue(createMockAgent());
    sectionState.suspended = true;

    // Act
    const component = await AgentDetailPage({
      params: Promise.resolve({ id: "agent-uuid-1" }),
    });
    await act(async () => {
      render(component);
    });

    // Assert
    expect(screen.getByTestId("agent-details-content")).toHaveAttribute(
      "data-agent-id",
      "test-agent",
    );
    expect(
      screen.queryByTestId("agent-tab-contents-section"),
    ).not.toBeInTheDocument();
  });

  it("calls notFound when agent is missing", async () => {
    // Setup
    getAgentByIdMock.mockResolvedValue(null);

    // Act
    await expect(
      AgentDetailPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
  });
});

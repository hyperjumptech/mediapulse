import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentByIdMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/agents", () => ({
  getAgentById: (...args: unknown[]) => getAgentByIdMock(...args),
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

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
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
});

describe("AgentDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getAgentByIdMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders agent details content when agent exists", async () => {
    // Setup
    const agent = createMockAgent();
    getAgentByIdMock.mockResolvedValue(agent);

    // Act
    const component = await AgentDetailPage({
      params: Promise.resolve({ id: "agent-uuid-1" }),
    });
    render(component);

    // Assert
    expect(screen.getByTestId("agent-details-content")).toBeInTheDocument();
    expect(screen.getByTestId("agent-details-content")).toHaveAttribute(
      "data-agent-id",
      "test-agent",
    );
    expect(screen.getByTestId("agent-details-content")).toHaveAttribute(
      "data-agent-version",
      "1.0",
    );
  });

  it("calls getAgentById with id from params", async () => {
    // Setup
    getAgentByIdMock.mockResolvedValue(createMockAgent());

    // Act
    await AgentDetailPage({
      params: Promise.resolve({ id: "my-agent-id" }),
    });

    // Assert
    expect(getAgentByIdMock).toHaveBeenCalledWith("my-agent-id");
  });

  it("calls notFound when agent does not exist", async () => {
    // Setup
    getAgentByIdMock.mockResolvedValue(null);

    // Act
    await AgentDetailPage({
      params: Promise.resolve({ id: "non-existent" }),
    });

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
  });
});

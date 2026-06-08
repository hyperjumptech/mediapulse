import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentByIdMock = vi.fn();
const getAgentInsightsMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL:
      "postgresql://mediapulse:mediapulse@localhost:5432/mediapulse",
    TEMP_ADMIN_USERNAME: "test",
    TEMP_ADMIN_PASSWORD: "testtest",
    HERMES_INTERNAL_API_KEY: "test-key",
    AGENT_DATA_API_URL: "http://test-agent-data-api",
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/agents", () => ({
  getAgentById: (...args: unknown[]) => getAgentByIdMock(...args),
}));

vi.mock("@/lib/agent-insights-api", () => ({
  getAgentInsights: (...args: unknown[]) => getAgentInsightsMock(...args),
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
    getAgentInsightsMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders agent details content when agent exists", async () => {
    // Setup
    const agent = createMockAgent();
    getAgentByIdMock.mockResolvedValue(agent);
    getAgentInsightsMock.mockResolvedValue({ hasInsights: false });

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
    getAgentInsightsMock.mockResolvedValue({ hasInsights: false });

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
    await expect(
      AgentDetailPage({ params: Promise.resolve({ id: "non-existent" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentByIdMock = vi.fn();
const fetchAgentTabContentsMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("@hermes/env", () => ({
  env: {
    ORCHESTRATION_DATABASE_URL:
      "postgresql://postgres:postgres@localhost:5432/hermes?schema=orchestration",
    TEMP_ADMIN_USERNAME: "test",
    TEMP_ADMIN_PASSWORD: "testtest",
    HERMES_INTERNAL_API_KEY: "test-key",
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

vi.mock("@/lib/domain-content-view", () => ({
  fetchAgentTabContents: (...args: unknown[]) =>
    fetchAgentTabContentsMock(...args),
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
  domainIntegration: { integrationId: "acme-local" },
});

describe("AgentDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getAgentByIdMock.mockReset();
    fetchAgentTabContentsMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders agent details content when agent exists", async () => {
    const agent = createMockAgent();
    getAgentByIdMock.mockResolvedValue(agent);
    fetchAgentTabContentsMock.mockResolvedValue([]);

    const component = await AgentDetailPage({
      params: Promise.resolve({ id: "agent-uuid-1" }),
    });
    render(component);

    expect(screen.getByTestId("agent-details-content")).toBeInTheDocument();
  });

  it("calls fetchAgentTabContents for the agent integration", async () => {
    getAgentByIdMock.mockResolvedValue(createMockAgent());
    fetchAgentTabContentsMock.mockResolvedValue([]);

    await AgentDetailPage({
      params: Promise.resolve({ id: "my-agent-id" }),
    });

    expect(fetchAgentTabContentsMock).toHaveBeenCalledWith(
      "acme-local",
      "test-agent",
    );
  });

  it("calls notFound when agent is missing", async () => {
    getAgentByIdMock.mockResolvedValue(null);

    await expect(
      AgentDetailPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});

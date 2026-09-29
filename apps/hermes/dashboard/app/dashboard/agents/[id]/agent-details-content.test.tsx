import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentDetailsContent } from "./agent-details-content";

vi.mock("../endpoint-display", async (importOriginal) => {
  const endpointDisplayModule =
    await importOriginal<typeof import("../endpoint-display")>();

  return {
    ...endpointDisplayModule,
    EndpointDisplay: ({ endpoint }: { endpoint: unknown }) => (
      <div
        data-testid="endpoint-display"
        data-endpoint={JSON.stringify(endpoint)}
      >
        Endpoint
      </div>
    ),
  };
});

vi.mock("@/components/json-block", () => ({
  JsonBlock: ({ value, title }: { value: unknown; title?: string }) => (
    <div
      data-testid="json-block"
      data-title={title ?? ""}
      data-value={JSON.stringify(value)}
    >
      JSON
    </div>
  ),
}));

vi.mock("./agent-unregister-button", () => ({
  AgentUnregisterButton: ({
    agentId,
    agentLabel,
  }: {
    agentId: string;
    agentLabel: string;
  }) => (
    <button
      data-testid="unregister-agent"
      data-agent-id={agentId}
      type="button"
    >
      Unregister {agentLabel}
    </button>
  ),
}));

const createMockAgent = () => ({
  id: "agent-123",
  domainIntegrationId: "di-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://api.example.com/run", method: "POST" },
  inputSchema: { type: "object", properties: {} },
  configSchema: { type: "object" },
  isActive: true,
  createdAt: new Date("2026-09-25T12:00:00Z"),
  updatedAt: new Date("2026-09-28T11:00:00Z"),
  domainIntegration: {
    integrationId: "acme-local",
    name: "Acme",
  },
});

const insightsTabContent = {
  view: {
    id: "operator-agent-insights",
    label: "Insights",
    tabLabel: "Insights",
    kind: "html" as const,
    placement: "agent-tab" as const,
    apiPrefix: "/v1/hermes-dashboard/content/agent-insights",
    order: 10,
  },
  content: { body: "<p>Insights body</p>", title: "Insights" },
};

const summaryValue = (label: string) => {
  const term = screen.getAllByText(label, { selector: "dt" })[0];

  return term?.nextElementSibling as HTMLElement;
};

describe("AgentDetailsContent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the agent key as a monospace title with status and description", () => {
    render(<AgentDetailsContent agent={createMockAgent()} />);

    expect(screen.getByText("active")).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("shows an inactive status and no description when absent", () => {
    const agent = { ...createMockAgent(), isActive: false, description: null };

    render(<AgentDetailsContent agent={agent} />);

    expect(screen.getByText("inactive")).toHaveAttribute("data-tone", "muted");
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
  });

  it("offers unregister as the header action", () => {
    render(<AgentDetailsContent agent={createMockAgent()} />);

    const unregisterButton = screen.getByTestId("unregister-agent");

    expect(unregisterButton).toHaveTextContent("Unregister test-agent@1.0");
    expect(unregisterButton).toHaveAttribute("data-agent-id", "agent-123");
    expect(unregisterButton.parentElement).toHaveAttribute(
      "data-slot",
      "page-header-actions",
    );
  });

  it("summarizes integration, endpoint and last update", () => {
    render(<AgentDetailsContent agent={createMockAgent()} />);

    const endpoint = summaryValue("Endpoint URL");

    expect(summaryValue("Integration")).toHaveTextContent("Acme");
    expect(endpoint).toHaveTextContent("POSThttps://api.example.com/run");
    expect(
      within(endpoint).getByRole("button", { name: "Copy endpoint URL" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
    expect(summaryValue("Updated")).toHaveTextContent("Sep 28, 2026, 11:00");
  });

  it("shows No endpoint when the endpoint has no URL", () => {
    const agent = { ...createMockAgent(), endpoint: { method: "POST" } };

    render(<AgentDetailsContent agent={agent} />);

    expect(summaryValue("Endpoint URL")).toHaveTextContent("No endpoint");
  });

  it("shows the schemas without tabs when there is nothing else to switch to", () => {
    render(<AgentDetailsContent agent={createMockAgent()} />);

    const jsonBlocks = screen.getAllByTestId("json-block");

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(jsonBlocks.map((block) => block.dataset.title)).toEqual([
      "Input schema",
      "Config schema",
    ]);
    expect(jsonBlocks.map((block) => block.dataset.value)).toEqual([
      JSON.stringify({ type: "object", properties: {} }),
      JSON.stringify({ type: "object" }),
    ]);
    expect(jsonBlocks[0]?.parentElement).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-2",
    );
  });

  it("puts domain tabs first and opens the first one by default", () => {
    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContents={[insightsTabContent]}
      />,
    );

    const tabLabels = within(screen.getByRole("tablist"))
      .getAllByRole("tab")
      .map((tab) => tab.textContent);

    expect(tabLabels).toEqual(["Insights", "Schema"]);
    expect(screen.getByRole("tab", { name: "Insights" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(
      screen.getByRole("tabpanel").querySelector("iframe"),
    ).toHaveAttribute("srcdoc", "<p>Insights body</p>");
  });

  it("ignores domain tabs whose view kind cannot render as content", () => {
    const tableTab = {
      ...insightsTabContent,
      view: {
        ...insightsTabContent.view,
        id: "agent-table",
        kind: "table-v1" as const,
      },
    };

    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContents={[tableTab as unknown as typeof insightsTabContent]}
      />,
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("adds an Endpoint tab only for endpoint settings beyond the URL and method", () => {
    const agent = {
      ...createMockAgent(),
      endpoint: {
        url: "https://api.example.com/run",
        method: "POST",
        headers: { "x-team": "ops" },
      },
    };
    render(<AgentDetailsContent agent={agent} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Endpoint" }));

    expect(
      within(screen.getByRole("tabpanel")).getByTestId("endpoint-display"),
    ).toHaveAttribute(
      "data-endpoint",
      JSON.stringify({ headers: { "x-team": "ops" } }),
    );
  });

  it("renders the tab contents error as an alert above the tabs", () => {
    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContentsError="Could not load integration tabs for this agent."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load integration tabs for this agent.",
    );
    expect(screen.getAllByTestId("json-block")).toHaveLength(2);
  });

  it("renders no error alert when the tab contents loaded", () => {
    render(
      <AgentDetailsContent agent={createMockAgent()} agentTabContents={[]} />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

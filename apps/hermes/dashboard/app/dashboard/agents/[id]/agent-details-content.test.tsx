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

vi.mock("../json-pretty", () => ({
  JsonPretty: ({ value, title }: { value: unknown; title?: string }) => (
    <div data-testid="json-pretty" data-title={title ?? ""}>
      {value == null ? "No schema" : "JSON"}
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
    // Act
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Assert
    expect(screen.getByText("active")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("shows an inactive status and no description when absent", () => {
    // Setup
    const agent = { ...createMockAgent(), isActive: false, description: null };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByText("inactive")).toHaveAttribute(
      "data-variant",
      "muted",
    );
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
  });

  it("offers unregister as the header action", () => {
    // Act
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Assert
    const unregisterButton = screen.getByTestId("unregister-agent");

    expect(unregisterButton).toHaveTextContent("Unregister test-agent@1.0");
    expect(unregisterButton).toHaveAttribute("data-agent-id", "agent-123");
    expect(unregisterButton.parentElement).toHaveAttribute(
      "data-slot",
      "page-header-actions",
    );
  });

  it("summarizes integration, endpoint and timestamps", () => {
    // Act
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Assert
    const endpoint = summaryValue("Endpoint URL");

    expect(summaryValue("Integration")).toHaveTextContent("acme-local");
    expect(endpoint).toHaveTextContent("https://api.example.com/run");
    expect(
      within(endpoint).getByRole("button", { name: "Copy endpoint URL" }),
    ).toBeInTheDocument();
    expect(summaryValue("Created")).toHaveTextContent("Sep 25, 2026, 12:00");
    expect(summaryValue("Updated")).toHaveTextContent("Sep 28, 2026, 11:00");
  });

  it("shows No endpoint when the endpoint has no URL", () => {
    // Setup
    const agent = { ...createMockAgent(), endpoint: { method: "POST" } };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(summaryValue("Endpoint URL")).toHaveTextContent("No endpoint");
  });

  it("uses line tabs with Schema and Info when there are no domain tabs", () => {
    // Act
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Assert
    const tabList = screen.getByRole("tablist");
    const tabLabels = within(tabList)
      .getAllByRole("tab")
      .map((tab) => tab.textContent);

    expect(tabList).toHaveAttribute("data-variant", "line");
    expect(tabLabels).toEqual(["Schema", "Info"]);
    expect(screen.getByRole("tab", { name: "Schema" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("puts domain tabs first and opens the first one by default", () => {
    // Act
    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContents={[insightsTabContent]}
      />,
    );

    // Assert
    const tabLabels = within(screen.getByRole("tablist"))
      .getAllByRole("tab")
      .map((tab) => tab.textContent);

    expect(tabLabels).toEqual(["Insights", "Schema", "Info"]);
    expect(screen.getByRole("tab", { name: "Insights" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(
      screen.getByRole("tabpanel").querySelector("iframe"),
    ).toHaveAttribute("srcdoc", "<p>Insights body</p>");
  });

  it("ignores domain tabs whose view kind cannot render as content", () => {
    // Setup
    const tableTab = {
      ...insightsTabContent,
      view: {
        ...insightsTabContent.view,
        id: "agent-table",
        kind: "table-v1" as const,
      },
    };

    // Act
    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContents={[tableTab as unknown as typeof insightsTabContent]}
      />,
    );

    // Assert
    expect(
      within(screen.getByRole("tablist"))
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Schema", "Info"]);
  });

  it("renders both schemas in the Schema tab", () => {
    // Act
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Assert
    const schemaPanel = screen.getByRole("tabpanel");
    const jsonBlocks = within(schemaPanel).getAllByTestId("json-pretty");

    expect(jsonBlocks.map((block) => block.dataset.title)).toEqual([
      "Input schema",
      "Config schema",
    ]);
  });

  it("shows registry details and the endpoint in the Info tab", () => {
    // Setup
    render(<AgentDetailsContent agent={createMockAgent()} />);

    // Act
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Info" }));

    // Assert
    const infoPanel = screen.getByRole("tabpanel");

    expect(within(infoPanel).getByText("test-agent")).toBeInTheDocument();
    expect(within(infoPanel).getByText("1.0")).toBeInTheDocument();
    expect(within(infoPanel).getByText("agent-123")).toBeInTheDocument();
    expect(within(infoPanel).getByTestId("endpoint-display")).toHaveAttribute(
      "data-endpoint",
      JSON.stringify({ url: "https://api.example.com/run", method: "POST" }),
    );
  });

  it("renders the tab contents error as an alert above the tabs", () => {
    // Act
    render(
      <AgentDetailsContent
        agent={createMockAgent()}
        agentTabContentsError="Could not load integration tabs for this agent."
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load integration tabs for this agent.",
    );
    expect(screen.getByRole("tab", { name: "Schema" })).toBeInTheDocument();
  });

  it("renders no error alert when the tab contents loaded", () => {
    // Act
    render(
      <AgentDetailsContent agent={createMockAgent()} agentTabContents={[]} />,
    );

    // Assert
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

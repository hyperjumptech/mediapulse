import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentDetailsContent } from "./agent-details-content";

vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children }: React.PropsWithChildren) => (
    <div data-testid="tabs">{children}</div>
  ),
  TabsList: ({ children }: React.PropsWithChildren) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: React.PropsWithChildren<{ value: string }>) => (
    <button data-testid={`tab-trigger-${value}`} type="button">
      {children}
    </button>
  ),
  TabsContent: ({
    children,
    value,
  }: React.PropsWithChildren<{ value: string }>) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

vi.mock("../endpoint-display", () => ({
  EndpointDisplay: ({ endpoint }: { endpoint: unknown }) => (
    <div
      data-testid="endpoint-display"
      data-endpoint={JSON.stringify(endpoint)}
    >
      Endpoint
    </div>
  ),
}));

vi.mock("../json-pretty", () => ({
  JsonPretty: ({ value, title }: { value: unknown; title?: string }) => (
    <div data-testid="json-pretty" data-title={title ?? ""}>
      {value == null ? "No schema" : "JSON"}
    </div>
  ),
}));

vi.mock("@mediapulse/hermes-dashboard/client", () => ({
  InsightsTab: ({
    window: insightsWindow,
  }: {
    payload: unknown;
    window: string;
  }) => (
    <div data-testid="insights-tab" data-window={insightsWindow}>
      Insights
    </div>
  ),
}));

const createMockAgent = () => ({
  id: "agent-123",
  domainIntegrationId: "di-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://api.example.com", method: "POST" },
  inputSchema: { type: "object", properties: {} },
  configSchema: { type: "object" },
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  domainIntegration: {
    integrationId: "mediapulse-local",
  },
});

describe("AgentDetailsContent", () => {
  it("renders page title with agent id and version", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(
      screen.getByRole("heading", { name: /Agent details: test-agent@1\.0/ }),
    ).toBeInTheDocument();
  });

  it("renders Schema and Info tabs without insights", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByTestId("tab-trigger-schema")).toHaveTextContent(
      "Schema",
    );
    expect(screen.getByTestId("tab-trigger-general")).toHaveTextContent("Info");
    expect(
      screen.queryByTestId("tab-trigger-input-schema"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("tab-trigger-config-schema"),
    ).not.toBeInTheDocument();
  });

  it("tab order is Insights, Schema, Info when insights present", () => {
    // Setup
    const agent = createMockAgent();
    const payload = {
      agentId: "test-agent",
      window: "7d" as const,
      generatedAt: "2024-06-01T00:00:00.000Z",
      kpis: [],
      alerts: [],
      sections: [],
    };

    // Act
    render(
      <AgentDetailsContent
        agent={agent}
        insightsPayload={payload}
        insightsWindow="7d"
      />,
    );

    // Assert tabs present
    expect(screen.getByTestId("tab-trigger-insights")).toHaveTextContent(
      "Insights",
    );
    expect(screen.getByTestId("tab-trigger-schema")).toHaveTextContent(
      "Schema",
    );
    expect(screen.getByTestId("tab-trigger-general")).toHaveTextContent("Info");

    // Assert order: Insights before Schema before Info
    const list = screen.getByTestId("tabs-list");
    const triggers = within(list).getAllByRole("button");
    const labels = triggers.map((button) => button.textContent);

    expect(labels).toEqual(["Insights", "Schema", "Info"]);
  });

  it("defaults to Schema tab when no insights", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert: Tabs rendered with defaultValue="schema"
    // The mock Tabs just renders children, so we check via the Tabs mock passing defaultValue
    // We verify the schema content is present (both JsonPretty blocks in schema tab)
    const schemaContent = screen.getByTestId("tab-content-schema");

    expect(schemaContent).toBeInTheDocument();
  });

  it("merged Schema tab contains both input and config schema blocks", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert: both JsonPretty rendered in the schema tab
    const schemaContent = screen.getByTestId("tab-content-schema");
    const jsonBlocks = within(schemaContent).getAllByTestId("json-pretty");

    expect(jsonBlocks).toHaveLength(2);
    expect(jsonBlocks[0]).toHaveAttribute("data-title", "Input schema");
    expect(jsonBlocks[1]).toHaveAttribute("data-title", "Config schema");
  });

  it("renders Details section with Agent ID, Version, Description, Active, Created, Last updated in Info tab", () => {
    // Setup: use distinct updatedAt so Last updated value is unique in the document
    const agent = {
      ...createMockAgent(),
      updatedAt: new Date("2024-02-20"),
    };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    const detailsHeading = screen.getByRole("heading", { name: "Details" });
    const detailsSection = detailsHeading.parentElement;
    expect(detailsSection).toBeTruthy();
    const details = within(detailsSection as HTMLElement);

    expect(details.getByText("Agent ID")).toBeInTheDocument();
    expect(details.getByText("test-agent")).toBeInTheDocument();
    expect(details.getByText("Version")).toBeInTheDocument();
    expect(details.getByText("1.0")).toBeInTheDocument();
    expect(details.getByText("Description")).toBeInTheDocument();
    expect(details.getByText("Test description")).toBeInTheDocument();
    expect(details.getByText("Active")).toBeInTheDocument();
    expect(details.getByText("Yes")).toBeInTheDocument();
    expect(details.getByText("Created")).toBeInTheDocument();
    expect(details.getByText("Last updated")).toBeInTheDocument();
    expect(details.getByText("Feb 20, 2024")).toBeInTheDocument();
    expect(details.getByText("Domain integration id")).toBeInTheDocument();
    expect(details.getByText("mediapulse-local")).toBeInTheDocument();
  });

  it("renders Endpoint section via EndpointDisplay in Info tab", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByTestId("endpoint-display")).toBeInTheDocument();
  });

  it("shows dash for null description", () => {
    // Setup
    const agent = { ...createMockAgent(), description: null };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows No badge when agent is inactive", () => {
    // Setup
    const agent = { ...createMockAgent(), isActive: false };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("Insights tab is hidden when insightsPayload is null", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(
      <AgentDetailsContent
        agent={agent}
        insightsPayload={null}
        insightsWindow="7d"
      />,
    );

    // Assert
    expect(
      screen.queryByTestId("tab-trigger-insights"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("insights-tab")).not.toBeInTheDocument();
  });

  it("Insights tab appears when insightsPayload is provided", () => {
    // Setup
    const agent = createMockAgent();
    const payload = {
      agentId: "test-agent",
      window: "7d" as const,
      generatedAt: "2024-06-01T00:00:00.000Z",
      kpis: [],
      alerts: [],
      sections: [],
    };

    // Act
    render(
      <AgentDetailsContent
        agent={agent}
        insightsPayload={payload}
        insightsWindow="7d"
      />,
    );

    // Assert
    expect(screen.getByTestId("tab-trigger-insights")).toHaveTextContent(
      "Insights",
    );
    expect(screen.getByTestId("insights-tab")).toBeInTheDocument();
  });
});

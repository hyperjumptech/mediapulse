import React from "react";
import { render, screen } from "@testing-library/react";
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

const createMockAgent = () => ({
  id: "agent-123",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://api.example.com", method: "POST" },
  inputSchema: { type: "object", properties: {} },
  configSchema: { type: "object" },
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
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

  it("renders General, Input schema, and Config schema tabs", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByTestId("tab-trigger-general")).toHaveTextContent(
      "General",
    );
    expect(screen.getByTestId("tab-trigger-input-schema")).toHaveTextContent(
      "Input schema",
    );
    expect(screen.getByTestId("tab-trigger-config-schema")).toHaveTextContent(
      "Config schema",
    );
  });

  it("renders Details section with Agent ID, Version, Description, Active, Created, Last updated in General tab", () => {
    // Setup: use distinct updatedAt so Last updated value is unique in the document
    const agent = {
      ...createMockAgent(),
      updatedAt: new Date("2024-02-20"),
    };

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByText("Agent ID")).toBeInTheDocument();
    expect(screen.getByText("test-agent")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
    expect(screen.getByText("Feb 20, 2024")).toBeInTheDocument();
  });

  it("renders Endpoint section via EndpointDisplay in General tab", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    expect(screen.getByTestId("endpoint-display")).toBeInTheDocument();
  });

  it("renders JsonPretty for input and config schema in their tabs", () => {
    // Setup
    const agent = createMockAgent();

    // Act
    render(<AgentDetailsContent agent={agent} />);

    // Assert
    const jsonPretties = screen.getAllByTestId("json-pretty");
    expect(jsonPretties).toHaveLength(2);
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
});

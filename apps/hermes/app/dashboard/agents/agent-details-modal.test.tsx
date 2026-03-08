import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentDetailsModal } from "./agent-details-modal";

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

const createMockAgent = () => ({
  id: "agent-123",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://api.example.com/run", method: "POST" },
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  configSchema: { type: "object", properties: { limit: { type: "number" } } },
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

describe("AgentDetailsModal", () => {
  it("returns null when agent is null", () => {
    const { container } = render(
      <AgentDetailsModal agent={null} open={true} onOpenChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with agent details title", () => {
    const agent = createMockAgent();
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(
      screen.getByRole("heading", { name: /Agent details: test-agent@1\.0/ }),
    ).toBeInTheDocument();
  });

  it("renders Agent ID, Version, Description, Active, Created", () => {
    const agent = createMockAgent();
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText("Agent ID")).toBeInTheDocument();
    expect(screen.getByText("test-agent")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("renders endpoint via EndpointDisplay", () => {
    const agent = createMockAgent();
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByTestId("endpoint-display")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/run")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("renders input and config schema via JsonSchemaSummary", () => {
    const agent = createMockAgent();
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText("Input schema")).toBeInTheDocument();
    expect(screen.getByText("Config schema")).toBeInTheDocument();
    expect(screen.getAllByText("query").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("limit")).toBeInTheDocument();
  });

  it("shows dash for null description", () => {
    const agent = { ...createMockAgent(), description: null };
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows No badge when agent is inactive", () => {
    const agent = { ...createMockAgent(), isActive: false };
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("passes open state to dialog", () => {
    const agent = createMockAgent();
    render(
      <AgentDetailsModal agent={agent} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
  });
});

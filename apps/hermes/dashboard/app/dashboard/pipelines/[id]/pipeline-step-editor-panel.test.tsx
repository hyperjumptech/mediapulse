import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentContractSummary } from "@/lib/agent-contracts";

import { PipelineStepEditorPanel } from "./pipeline-step-editor-panel";

const mockSetActiveTab = vi.fn();

vi.mock("./use-step-editor-panel-state", () => ({
  useStepEditorPanelState: () => ({
    schemas: {
      inputSchema: { type: "object", properties: {} },
      configSchema: null,
    },
    schemaLoading: false,
    activeTab: "config" as const,
    setActiveTab: mockSetActiveTab,
  }),
}));

vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs">{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <button type="button" data-testid={`tab-${value}`}>
      {children}
    </button>
  ),
  TabsContent: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`tab-content-${value}`}>{children}</div>,
}));

vi.mock("@workspace/json-schema-form", () => ({
  SchemaForm: ({
    value,
    onChange,
  }: {
    schema?: unknown;
    value: unknown;
    onChange: (v: unknown) => void;
  }) => (
    <div data-testid="schema-form">
      <input
        data-testid="schema-form-input"
        value={JSON.stringify(value)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange({});
          }
        }}
      />
    </div>
  ),
}));

vi.mock("@workspace/variable-expansion-picker", () => ({
  createVariableExpansionStringField: () => {
    const Stub = () => (
      <input data-testid="variable-expansion-input" readOnly />
    );
    return Stub;
  },
}));

const noopLoaders = {
  loadVariablePickerPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  loadExpansionPickerPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
};

const noopContractProps = {
  allContracts: [] as AgentContractSummary[],
  stepAgentContractId: "",
  onStepAgentContractIdChange: () => {},
};

const selectedStep = {
  id: "step-1",
  order: 0,
  agentId: "summarizer",
  agentVersion: "1.0",
  agentConfigId: null as string | null,
  input: {},
  config: {},
};

describe("PipelineStepEditorPanel", () => {
  it("shows select-step message when no step selected", () => {
    render(
      <PipelineStepEditorPanel
        selectedStep={null}
        stepInput={{}}
        onStepInputChange={() => {}}
        configsForAgent={[]}
        stepAgentConfigId=""
        onStepAgentConfigIdChange={() => {}}
        {...noopContractProps}
        {...noopLoaders}
      />,
    );

    expect(
      screen.getByText(
        "Select a step in the pipeline to edit its input and config.",
      ),
    ).toBeInTheDocument();
  });

  it("Config tab shows empty state with link when no configs for agent", () => {
    render(
      <PipelineStepEditorPanel
        selectedStep={selectedStep}
        stepInput={{}}
        onStepInputChange={() => {}}
        configsForAgent={[]}
        stepAgentConfigId=""
        onStepAgentConfigIdChange={() => {}}
        {...noopContractProps}
        {...noopLoaders}
      />,
    );

    expect(
      screen.getByText("No agent configs for this agent. Create one first."),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Go to Agent configs" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard/agent-configs");
  });

  it("Config tab shows picker when configs exist and calls onStepAgentConfigIdChange on change", () => {
    const onStepAgentConfigIdChange = vi.fn();
    const configs = [
      {
        id: "cfg-1",
        name: "Config A",
        description: "First config",
        configSchemaFingerprint: null,
      },
      {
        id: "cfg-2",
        name: "Config B",
        description: null,
        configSchemaFingerprint: null,
      },
    ];

    render(
      <PipelineStepEditorPanel
        selectedStep={selectedStep}
        stepInput={{}}
        onStepInputChange={() => {}}
        configsForAgent={configs}
        stepAgentConfigId=""
        onStepAgentConfigIdChange={onStepAgentConfigIdChange}
        {...noopContractProps}
        {...noopLoaders}
      />,
    );

    const picker = screen.getByRole("combobox", {
      name: "Choose a saved agent config",
    });
    expect(picker).toBeInTheDocument();
    expect(screen.getByLabelText("Agent config *")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Config A — First config" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Config B" }),
    ).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "cfg-1" } });

    expect(onStepAgentConfigIdChange).toHaveBeenCalledWith("cfg-1");
  });
});

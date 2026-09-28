import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentConfigFormFields } from "./agent-config-form-fields";

const schemaFormSpy = vi.fn();

vi.mock("@workspace/json-schema-form", () => ({
  SchemaForm: (props: Record<string, unknown>) => {
    schemaFormSpy(props);
    return <div data-testid="schema-form" />;
  },
}));

describe("AgentConfigFormFields", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    schemaFormSpy.mockReset();
  });

  it("passes a custom StringField to SchemaForm for config schemas", async () => {
    // Setup
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        configSchema: {
          type: "object",
          properties: { prompt: { type: "string" } },
        },
      }),
    } as Response);

    // Act
    render(
      <AgentConfigFormFields
        name="Config A"
        description=""
        agentKey="summarizer@1.0.0"
        config={{}}
        agents={[{ id: "a1", agentId: "summarizer", agentVersion: "1.0.0" }]}
        onNameChange={() => {}}
        onDescriptionChange={() => {}}
        onAgentChange={() => {}}
        onConfigChange={() => {}}
        pickerLoaders={{
          loadVariablesPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
          loadExpansionsPage: vi
            .fn()
            .mockResolvedValue({ items: [], total: 0 }),
        }}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(schemaFormSpy).toHaveBeenCalled();
    });
    expect(schemaFormSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.objectContaining({
          StringField: expect.any(Function),
        }),
      }),
    );
  });

  it("clears the config when a different agent is picked", () => {
    // Setup
    const onAgentChange = vi.fn();
    const onConfigChange = vi.fn();
    render(
      <AgentConfigFormFields
        name=""
        description=""
        agentKey=""
        config={{}}
        agents={[{ id: "a1", agentId: "summarizer", agentVersion: "1.0.0" }]}
        onNameChange={() => {}}
        onDescriptionChange={() => {}}
        onAgentChange={onAgentChange}
        onConfigChange={onConfigChange}
        pickerLoaders={{
          loadVariablesPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
          loadExpansionsPage: vi
            .fn()
            .mockResolvedValue({ items: [], total: 0 }),
        }}
      />,
    );

    expect(screen.queryByText("Configuration")).not.toBeInTheDocument();

    // Act
    fireEvent.change(screen.getByLabelText("Agent"), {
      target: { value: "summarizer@1.0.0" },
    });

    // Assert
    expect(onAgentChange).toHaveBeenCalledWith("summarizer@1.0.0");
    expect(onConfigChange).toHaveBeenCalledWith({});
  });

  it("explains when the agent has no config schema", async () => {
    // Setup
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Act
    render(
      <AgentConfigFormFields
        name="Config A"
        description=""
        agentKey="summarizer@1.0.0"
        config={{}}
        agents={[{ id: "a1", agentId: "summarizer", agentVersion: "1.0.0" }]}
        onNameChange={() => {}}
        onDescriptionChange={() => {}}
        onAgentChange={() => {}}
        onConfigChange={() => {}}
        pickerLoaders={{
          loadVariablesPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
          loadExpansionsPage: vi
            .fn()
            .mockResolvedValue({ items: [], total: 0 }),
        }}
      />,
    );

    // Assert
    expect(
      await screen.findByText(
        "This agent has no config schema. Config will be saved as empty.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
  });
});

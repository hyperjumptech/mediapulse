import { render, waitFor } from "@testing-library/react";
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
        variableKeys={[{ key: "tickerId" }]}
        expansionTemplates={[
          { id: "e1", name: "Tickers", expansionString: "db:ticker:id" },
        ]}
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
});

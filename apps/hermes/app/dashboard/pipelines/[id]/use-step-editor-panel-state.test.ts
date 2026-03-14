import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useStepEditorPanelState,
  type FetchAgentSchemas,
  type StepForEditor,
} from "./use-step-editor-panel-state";

const validInputSchema = {
  type: "object",
  properties: { x: { type: "string" } },
} as Record<string, unknown>;

const validConfigSchema = {
  type: "object",
  properties: { y: { type: "number" } },
} as Record<string, unknown>;

const createStep = (overrides: Partial<StepForEditor> = {}): StepForEditor => ({
  id: "step-1",
  agentId: "agent-a",
  agentVersion: "v1",
  ...overrides,
});

describe("useStepEditorPanelState", () => {
  it("returns null schemas and input tab when selectedStep is null", () => {
    const { result } = renderHook(() => useStepEditorPanelState(null));

    expect(result.current.schemas).toEqual({
      inputSchema: null,
      configSchema: null,
    });
    expect(result.current.schemaLoading).toBe(false);
    expect(result.current.activeTab).toBe("input");
    expect(typeof result.current.setActiveTab).toBe("function");
  });

  it("sets schemaLoading true then loads schemas via fetchAgentSchemas", async () => {
    const fetchSchemas = vi.fn<FetchAgentSchemas>().mockResolvedValue({
      inputSchema: validInputSchema,
      configSchema: validConfigSchema,
    });
    const step = createStep();

    const { result } = renderHook(() =>
      useStepEditorPanelState(step, { fetchAgentSchemas: fetchSchemas }),
    );

    expect(fetchSchemas).toHaveBeenCalledWith("agent-a", "v1");
    await waitFor(() => {
      expect(result.current.schemaLoading).toBe(false);
    });
    expect(result.current.schemas.inputSchema).toEqual(validInputSchema);
    expect(result.current.schemas.configSchema).toEqual(validConfigSchema);
  });

  it("clears schemas when fetch returns null", async () => {
    const fetchSchemas = vi.fn<FetchAgentSchemas>().mockResolvedValue(null);
    const step = createStep();

    const { result } = renderHook(() =>
      useStepEditorPanelState(step, { fetchAgentSchemas: fetchSchemas }),
    );

    await waitFor(() => {
      expect(result.current.schemaLoading).toBe(false);
    });
    expect(result.current.schemas).toEqual({
      inputSchema: null,
      configSchema: null,
    });
  });

  it("resets activeTab to input when selectedStep id changes", async () => {
    const fetchSchemas = vi.fn<FetchAgentSchemas>().mockResolvedValue({
      inputSchema: validInputSchema,
      configSchema: validConfigSchema,
    });
    const step1 = createStep({ id: "step-1" });
    const step2 = createStep({ id: "step-2", agentId: "agent-b" });

    const { result, rerender } = renderHook(
      ({ selectedStep }) =>
        useStepEditorPanelState(selectedStep, {
          fetchAgentSchemas: fetchSchemas,
        }),
      { initialProps: { selectedStep: step1 } },
    );

    await waitFor(() => {
      expect(result.current.schemaLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveTab("config");
    });
    expect(result.current.activeTab).toBe("config");

    rerender({ selectedStep: step2 });

    await waitFor(() => {
      expect(result.current.activeTab).toBe("input");
    });
  });

  it("filters out non-object schemas without properties", async () => {
    const fetchSchemas = vi.fn<FetchAgentSchemas>().mockResolvedValue({
      inputSchema: { type: "string" },
      configSchema: { type: "object", properties: {} },
    });
    const step = createStep();

    const { result } = renderHook(() =>
      useStepEditorPanelState(step, { fetchAgentSchemas: fetchSchemas }),
    );

    await waitFor(() => {
      expect(result.current.schemaLoading).toBe(false);
    });
    expect(result.current.schemas.inputSchema).toBeNull();
    expect(result.current.schemas.configSchema).toEqual({
      type: "object",
      properties: {},
    });
  });
});

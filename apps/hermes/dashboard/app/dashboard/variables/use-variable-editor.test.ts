import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VariableRow } from "@/lib/variables";

import { useVariableEditor } from "./use-variable-editor";

const variable: VariableRow = {
  id: "variable-1",
  key: "API_URL",
  value: "https://api.example.com",
  note: null,
  isSecret: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
};

describe("useVariableEditor", () => {
  it("starts with no variable being edited", () => {
    const { result } = renderHook(() => useVariableEditor());

    expect(result.current.editingVariable).toBeNull();
  });

  it("opens the editor for a variable", () => {
    const { result } = renderHook(() => useVariableEditor());

    act(() => {
      result.current.openEditor(variable);
    });

    expect(result.current.editingVariable).toBe(variable);
  });

  it("keeps the variable while the editor stays open", () => {
    const { result } = renderHook(() => useVariableEditor());

    act(() => {
      result.current.openEditor(variable);
    });
    act(() => {
      result.current.handleEditorOpenChange(true);
    });

    expect(result.current.editingVariable).toBe(variable);
  });

  it("clears the variable when the editor closes", () => {
    const { result } = renderHook(() => useVariableEditor());

    act(() => {
      result.current.openEditor(variable);
    });
    act(() => {
      result.current.handleEditorOpenChange(false);
    });

    expect(result.current.editingVariable).toBeNull();
  });
});

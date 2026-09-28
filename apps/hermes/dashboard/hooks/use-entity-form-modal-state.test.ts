import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEntityFormModalState } from "./use-entity-form-modal-state";

describe("useEntityFormModalState", () => {
  it("starts closed in create mode without an edit target", () => {
    // Act
    const { result } = renderHook(() => useEntityFormModalState());

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.mode).toBe("create");
    expect(result.current.editId).toBeNull();
  });

  it("opens in edit mode for the requested entity", () => {
    // Setup
    const { result } = renderHook(() => useEntityFormModalState());

    // Act
    act(() => result.current.openEdit("schedule-1"));

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.mode).toBe("edit");
    expect(result.current.editId).toBe("schedule-1");
  });

  it("clears the edit target when opening in create mode", () => {
    // Setup
    const { result } = renderHook(() => useEntityFormModalState());
    act(() => result.current.openEdit("schedule-1"));

    // Act
    act(() => result.current.openCreate());

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.mode).toBe("create");
    expect(result.current.editId).toBeNull();
  });

  it("closes through setOpen", () => {
    // Setup
    const { result } = renderHook(() => useEntityFormModalState());
    act(() => result.current.openCreate());

    // Act
    act(() => result.current.setOpen(false));

    // Assert
    expect(result.current.open).toBe(false);
  });
});

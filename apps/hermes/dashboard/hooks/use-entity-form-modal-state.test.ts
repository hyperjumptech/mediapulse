import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let currentSearch = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { useEntityFormModalState } from "./use-entity-form-modal-state";

afterEach(() => {
  currentSearch = "";
  vi.restoreAllMocks();
});

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

  it("opens the create form when the URL asks for it", () => {
    currentSearch = "create=1&q=daily";

    const { result } = renderHook(() => useEntityFormModalState());

    expect(result.current.open).toBe(true);
    expect(result.current.mode).toBe("create");
  });

  it("drops the create flag from the URL when the form closes", () => {
    currentSearch = "create=1&q=daily";
    window.history.replaceState(
      null,
      "",
      "/dashboard/pipelines?create=1&q=daily",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useEntityFormModalState());

    act(() => result.current.setOpen(false));

    const nextUrl = String(replaceStateSpy.mock.calls.at(-1)?.[2]);

    expect(nextUrl).toContain("/dashboard/pipelines?q=daily");
    expect(nextUrl).not.toContain("create=1");
  });

  it("leaves the URL alone when no create flag was set", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useEntityFormModalState());

    act(() => result.current.openCreate());
    act(() => result.current.setOpen(false));

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});

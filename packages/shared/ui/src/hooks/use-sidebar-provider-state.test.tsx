import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSidebarProviderState } from "./use-sidebar-provider-state.js";

describe("useSidebarProviderState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes uncontrolled open from defaultOpen true", () => {
    // Act
    const { result } = renderHook(() =>
      useSidebarProviderState({ defaultOpen: true }),
    );

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe("expanded");
  });

  it("initializes uncontrolled open from defaultOpen false", () => {
    // Act
    const { result } = renderHook(() =>
      useSidebarProviderState({ defaultOpen: false }),
    );

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.state).toBe("collapsed");
  });

  it("updates uncontrolled state via setOpen", () => {
    // Setup
    const { result } = renderHook(() =>
      useSidebarProviderState({ defaultOpen: true }),
    );

    // Act
    act(() => {
      result.current.setOpen(false);
    });

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.state).toBe("collapsed");
  });

  it("toggles uncontrolled open via toggleSidebar", () => {
    // Setup
    const { result } = renderHook(() =>
      useSidebarProviderState({ defaultOpen: true }),
    );

    // Act
    act(() => {
      result.current.toggleSidebar();
    });

    // Assert
    expect(result.current.open).toBe(false);

    // Act
    act(() => {
      result.current.toggleSidebar();
    });

    // Assert
    expect(result.current.open).toBe(true);
  });

  it("derives open from controlled prop", () => {
    // Act
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useSidebarProviderState({ open, onOpenChange: vi.fn() }),
      { initialProps: { open: false } },
    );

    // Assert
    expect(result.current.open).toBe(false);

    // Act
    rerender({ open: true });

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe("expanded");
  });

  it("calls onOpenChange when setOpen runs under control without changing open until prop updates", () => {
    // Setup
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useSidebarProviderState({ open, onOpenChange }),
      { initialProps: { open: true } },
    );

    // Act
    act(() => {
      result.current.setOpen(false);
    });

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.open).toBe(true);

    // Act
    rerender({ open: false });

    // Assert
    expect(result.current.open).toBe(false);
  });

  it("invokes onOpenChange for uncontrolled setOpen and updates local open", () => {
    // Setup
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useSidebarProviderState({
        defaultOpen: true,
        onOpenChange,
      }),
    );

    // Act
    act(() => {
      result.current.setOpen(false);
    });

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.open).toBe(false);
  });
});

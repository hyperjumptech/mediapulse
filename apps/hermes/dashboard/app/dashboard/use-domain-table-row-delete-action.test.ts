import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDomainTableRowDeleteAction } from "./use-domain-table-row-delete-action";

describe("useDomainTableRowDeleteAction", () => {
  it("starts closed and opens when confirmation is requested", () => {
    // Setup
    const { result } = renderHook(() =>
      useDomainTableRowDeleteAction(vi.fn(async () => undefined)),
    );

    // Act
    act(() => result.current.requestConfirmation());

    // Assert
    expect(result.current.open).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.FormWithAction).toBeTypeOf("function");
  });

  it("keeps the same form component across renders", () => {
    // Setup
    const deleteAction = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(() =>
      useDomainTableRowDeleteAction(deleteAction),
    );
    const firstForm = result.current.FormWithAction;

    // Act
    rerender();

    // Assert
    expect(result.current.FormWithAction).toBe(firstForm);
  });

  it("stays usable after the dialog is dismissed", async () => {
    // Setup
    const { result } = renderHook(() =>
      useDomainTableRowDeleteAction(vi.fn(async () => undefined)),
    );
    act(() => result.current.requestConfirmation());

    // Act
    act(() => result.current.setOpen(false));

    // Assert
    await waitFor(() => {
      expect(result.current.open).toBe(false);
    });
  });
});

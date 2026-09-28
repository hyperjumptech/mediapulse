import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useConfirmActionDialog } from "./use-confirm-action-dialog";

type ActionState = { status?: boolean } | null;

describe("useConfirmActionDialog", () => {
  it("opens on request and closes once the action succeeds", () => {
    // Setup
    const { result, rerender } = renderHook(
      ({ state }: { state: ActionState }) => useConfirmActionDialog(state),
      { initialProps: { state: null as ActionState } },
    );

    // Act
    act(() => result.current.requestConfirmation());

    // Assert
    expect(result.current.open).toBe(true);

    rerender({ state: { status: true } });

    expect(result.current.open).toBe(false);
  });

  it("stays open when the action fails", () => {
    // Setup
    const { result, rerender } = renderHook(
      ({ state }: { state: ActionState }) => useConfirmActionDialog(state),
      { initialProps: { state: null as ActionState } },
    );
    act(() => result.current.requestConfirmation());

    // Act
    rerender({ state: { status: false } });

    // Assert
    expect(result.current.open).toBe(true);
  });
});

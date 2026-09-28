import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

import { useDomainTableDangerConfirmAction } from "./use-domain-table-danger-confirm-action";

describe("useDomainTableDangerConfirmAction", () => {
  it("starts idle with the dialog closed and no error", () => {
    // Act
    const { result } = renderHook(() =>
      useDomainTableDangerConfirmAction({
        serverAction: vi.fn(async () => ({ status: "idle" as const })),
      }),
    );

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("opens the dialog when confirmation is requested", () => {
    // Setup
    const { result } = renderHook(() =>
      useDomainTableDangerConfirmAction({
        serverAction: vi.fn(async () => ({ status: "idle" as const })),
      }),
    );

    // Act
    act(() => result.current.requestConfirmation());

    // Assert
    expect(result.current.open).toBe(true);
  });
});

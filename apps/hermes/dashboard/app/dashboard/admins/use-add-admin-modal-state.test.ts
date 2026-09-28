import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAddAdminModalState } from "./use-add-admin-modal-state";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: { id: string };
} | null;

const { searchParams, formActionState } = vi.hoisted(() => ({
  searchParams: { current: "" },
  formActionState: { current: null as MockFormActionState },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

vi.mock(
  "@/app/dashboard/admins/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => ({
      FormWithAction: () => null,
      state: formActionState.current,
      pending: false,
    }),
  }),
);

afterEach(() => {
  searchParams.current = "";
  formActionState.current = null;
});

describe("useAddAdminModalState", () => {
  it("starts closed without a create request", () => {
    // Act
    const { result } = renderHook(() => useAddAdminModalState());

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("opens when the URL asks to create an admin", () => {
    // Setup
    searchParams.current = "create=1";

    // Act
    const { result } = renderHook(() => useAddAdminModalState());

    // Assert
    expect(result.current.open).toBe(true);
  });

  it("closes once the create action succeeds", () => {
    // Setup
    searchParams.current = "create=1";
    const { result, rerender } = renderHook(() => useAddAdminModalState());

    // Act
    formActionState.current = { status: true, data: { id: "admin-1" } };
    rerender();

    // Assert
    expect(result.current.open).toBe(false);
  });

  it("exposes the action error message", () => {
    // Setup
    formActionState.current = { status: false, message: "Email taken" };

    // Act
    const { result } = renderHook(() => useAddAdminModalState());

    // Assert
    expect(result.current.errorMessage).toBe("Email taken");
  });

  it("closes through setOpen", () => {
    // Setup
    searchParams.current = "create=1";
    const { result } = renderHook(() => useAddAdminModalState());

    // Act
    act(() => result.current.setOpen(false));

    // Assert
    expect(result.current.open).toBe(false);
  });
});

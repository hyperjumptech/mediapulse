import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VariableRow } from "@/lib/variables";

import {
  useVariableModalState,
  useVariableUsageState,
} from "./use-variable-modal-state";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: { id: string };
} | null;

const { searchParams, createState, updateState, usageMock } = vi.hoisted(
  () => ({
    searchParams: { current: "" },
    createState: { current: null as MockFormActionState },
    updateState: { current: null as MockFormActionState },
    usageMock: vi.fn(),
  }),
);

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

vi.mock(
  "@/app/dashboard/variables/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => ({
      FormWithAction: () => null,
      state: createState.current,
      pending: false,
    }),
  }),
);

vi.mock(
  "@/app/dashboard/variables/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: () => ({
      FormWithAction: () => null,
      state: updateState.current,
      pending: false,
    }),
  }),
);

vi.mock("@/app/dashboard/variables/actions/get-usage", () => ({
  getVariablePipelineUsage: (...args: unknown[]) => usageMock(...args),
}));

const variable: VariableRow = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "API_KEY",
  value: "masked",
  note: null,
  isSecret: true,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  createdBy: null,
};

afterEach(() => {
  searchParams.current = "";
  createState.current = null;
  updateState.current = null;
  usageMock.mockReset();
});

describe("useVariableModalState", () => {
  it("keeps the create modal closed without a create request", () => {
    const { result } = renderHook(() =>
      useVariableModalState({ variable: null }),
    );
    expect(result.current.isCreate).toBe(true);
    expect(result.current.open).toBe(false);
    expect(result.current.title).toBe("Add variable");
  });

  it("opens the create modal when the URL asks for it", () => {
    searchParams.current = "create=1";
    const { result } = renderHook(() =>
      useVariableModalState({ variable: null }),
    );
    expect(result.current.open).toBe(true);
  });

  it("closes the create modal once the variable is created", () => {
    searchParams.current = "create=1";
    const { result, rerender } = renderHook(() =>
      useVariableModalState({ variable: null }),
    );
    createState.current = { status: true, data: { id: "variable-1" } };
    rerender();
    expect(result.current.open).toBe(false);
  });

  it("follows the controlled open state in edit mode, ignoring the URL", () => {
    searchParams.current = "create=1";
    const { result } = renderHook(() =>
      useVariableModalState({
        variable,
        open: false,
        onOpenChange: vi.fn(),
      }),
    );
    expect(result.current.isCreate).toBe(false);
    expect(result.current.open).toBe(false);
    expect(result.current.title).toBe("Edit variable: API_KEY");
  });

  it("asks the parent to close the edit modal after a successful update", () => {
    const onOpenChange = vi.fn();
    updateState.current = { status: true, data: { id: variable.id } };
    renderHook(() =>
      useVariableModalState({ variable, open: true, onOpenChange }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("useVariableUsageState", () => {
  it("loads pipeline usage when the usage tab opens", async () => {
    usageMock.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useVariableUsageState({ open: true, isCreate: false, variable }),
    );
    await act(async () => result.current.setActiveTab("usage"));
    expect(usageMock).toHaveBeenCalledWith("API_KEY");
    expect(result.current.usageState.status).toBe("loaded");
  });
  it("waits for Retry after a failed load instead of reloading on its own", async () => {
    usageMock.mockReset();
    usageMock.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useVariableUsageState({ open: true, isCreate: false, variable }),
    );

    await act(async () => result.current.setActiveTab("usage"));

    expect(result.current.usageState.status).toBe("error");
    expect(usageMock).toHaveBeenCalledTimes(1);

    usageMock.mockResolvedValueOnce([]);
    await act(async () => result.current.retry());

    expect(usageMock).toHaveBeenCalledTimes(2);
    expect(result.current.usageState.status).toBe("loaded");
  });
});

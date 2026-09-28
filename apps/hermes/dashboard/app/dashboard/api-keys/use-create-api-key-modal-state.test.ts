import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCreateApiKeyModalState } from "./use-create-api-key-modal-state";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: {
    id: string;
    label: string;
    readOnly: boolean;
    apiKeyPlaintext: string;
  };
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
  "@/app/dashboard/api-keys/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => ({
      FormWithAction: () => null,
      state: formActionState.current,
      pending: false,
    }),
  }),
);

const createdKey = {
  id: "key-1",
  label: "Cursor",
  readOnly: false,
  apiKeyPlaintext: "hmcp_secret_value",
};

afterEach(() => {
  searchParams.current = "";
  formActionState.current = null;
});

describe("useCreateApiKeyModalState", () => {
  it("starts closed without a create request or a created key", () => {
    // Act
    const { result } = renderHook(() => useCreateApiKeyModalState());

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.createdKey).toBeNull();
  });

  it("opens when the URL asks to create a key", () => {
    // Setup
    searchParams.current = "create=1";

    // Act
    const { result } = renderHook(() => useCreateApiKeyModalState());

    // Assert
    expect(result.current.open).toBe(true);
  });

  it("keeps the created key until the dialog closes", () => {
    // Setup
    searchParams.current = "create=1";
    formActionState.current = { status: true, data: createdKey };
    const { result } = renderHook(() => useCreateApiKeyModalState());

    // Act
    const keyBeforeClose = result.current.createdKey;
    act(() => result.current.handleOpenChange(false));

    // Assert
    expect(keyBeforeClose).toEqual(createdKey);
    expect(result.current.open).toBe(false);
    expect(result.current.createdKey).toBeNull();
  });

  it("ignores a success payload without a plaintext key", () => {
    // Setup
    formActionState.current = {
      status: true,
      data: { ...createdKey, apiKeyPlaintext: "" },
    };

    // Act
    const { result } = renderHook(() => useCreateApiKeyModalState());

    // Assert
    expect(result.current.createdKey).toBeNull();
  });

  it("exposes the action error message", () => {
    // Setup
    formActionState.current = { status: false, message: "Label is taken" };

    // Act
    const { result } = renderHook(() => useCreateApiKeyModalState());

    // Assert
    expect(result.current.errorMessage).toBe("Label is taken");
  });
});

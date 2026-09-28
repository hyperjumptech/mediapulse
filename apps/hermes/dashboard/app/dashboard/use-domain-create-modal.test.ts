import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDomainCreateModal } from "./use-domain-create-modal";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

describe("useDomainCreateModal", () => {
  afterEach(() => {
    searchParams.current = "";
  });

  it("starts closed without a create request", () => {
    const { result } = renderHook(() => useDomainCreateModal(vi.fn()));

    expect(result.current.open).toBe(false);
  });

  it("starts open when the URL asks to create", () => {
    searchParams.current = "create=1";

    const { result } = renderHook(() => useDomainCreateModal(vi.fn()));

    expect(result.current.open).toBe(true);
  });

  it("closes after the create action succeeds", async () => {
    searchParams.current = "create=1";
    const createAction = vi.fn(async () => {});
    const { result } = renderHook(() => useDomainCreateModal(createAction));
    const formData = new FormData();

    await act(async () => {
      await result.current.submit(formData);
    });

    expect(createAction).toHaveBeenCalledWith(formData);
    expect(result.current.open).toBe(false);
  });

  it("stays open when the create action fails", async () => {
    searchParams.current = "create=1";
    const createAction = vi.fn(async () => {
      throw new Error("Domain API failed");
    });
    const { result } = renderHook(() => useDomainCreateModal(createAction));

    const pending = act(async () => {
      await result.current.submit(new FormData());
    });

    await expect(pending).rejects.toThrow("Domain API failed");
    expect(result.current.open).toBe(true);
  });
});

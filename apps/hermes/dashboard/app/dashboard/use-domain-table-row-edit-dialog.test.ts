/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDomainTableRowEditDialog } from "./use-domain-table-row-edit-dialog";

describe("useDomainTableRowEditDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts closed and toggles via setEditOpen", () => {
    // Setup
    const { result } = renderHook(() => useDomainTableRowEditDialog());

    // Assert
    expect(result.current.editOpen).toBe(false);

    // Act
    act(() => {
      result.current.setEditOpen(true);
    });

    // Assert
    expect(result.current.editOpen).toBe(true);
  });
});

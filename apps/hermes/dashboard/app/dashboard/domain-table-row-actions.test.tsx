/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDomainTableRowDeleteLabel,
  useDomainTableRowEditDialog,
} from "./domain-table-row-actions";

describe("getDomainTableRowDeleteLabel", () => {
  it("uses trimmed name when present", () => {
    // Act
    const label = getDomainTableRowDeleteLabel({ name: "  PERSON  " }, "id-1");

    // Assert
    expect(label).toBe("PERSON");
  });

  it("falls back to row id when name is missing or blank", () => {
    // Act
    const missing = getDomainTableRowDeleteLabel({}, "row-2");
    const blank = getDomainTableRowDeleteLabel({ name: "   " }, "row-3");

    // Assert
    expect(missing).toBe("row-2");
    expect(blank).toBe("row-3");
  });

  it("falls back to row id when name is not a string", () => {
    // Act
    const label = getDomainTableRowDeleteLabel({ name: 42 }, "row-4");

    // Assert
    expect(label).toBe("row-4");
  });
});

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

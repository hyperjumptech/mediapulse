import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALL_ROWS_VALUE, useSubTableRowLimit } from "./use-sub-table-row-limit";

const rows = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`);

describe("useSubTableRowLimit", () => {
  it("starts limited to the first option", () => {
    const { result } = renderHook(() =>
      useSubTableRowLimit({ rows, options: [5, 10] }),
    );

    expect(result.current.value).toBe("5");
    expect(result.current.visibleRows).toEqual(rows.slice(0, 5));
  });

  it("starts on every row when defaultAll is set", () => {
    const { result } = renderHook(() =>
      useSubTableRowLimit({ rows, options: [5, 10], defaultAll: true }),
    );

    expect(result.current.value).toBe(ALL_ROWS_VALUE);
    expect(result.current.visibleRows).toEqual(rows);
  });

  it("changes the visible rows when a new limit is picked", () => {
    const { result } = renderHook(() =>
      useSubTableRowLimit({ rows, options: [5, 10] }),
    );

    act(() => {
      result.current.setValue("10");
    });

    expect(result.current.value).toBe("10");
    expect(result.current.visibleRows).toHaveLength(10);

    act(() => {
      result.current.setValue(ALL_ROWS_VALUE);
    });

    expect(result.current.visibleRows).toHaveLength(12);
  });
});

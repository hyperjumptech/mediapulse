import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const isMobileMock = vi.fn(() => false);

vi.mock("@workspace/ui/hooks/use-mobile", () => ({
  useIsMobile: () => isMobileMock(),
}));

import { isChartRange, useChartRange } from "./use-chart-range";

describe("useChartRange", () => {
  afterEach(() => {
    isMobileMock.mockReset();
    isMobileMock.mockReturnValue(false);
  });

  it("starts on three months and switches on valid values only", () => {
    const { result } = renderHook(() => useChartRange());

    act(() => result.current.selectRange("30d"));
    act(() => result.current.selectRange(""));

    expect(result.current.range).toBe("30d");
  });

  it("narrows to seven days on small screens", () => {
    isMobileMock.mockReturnValue(true);

    const { result } = renderHook(() => useChartRange());

    expect(result.current.range).toBe("7d");
  });
});

describe("isChartRange", () => {
  it("accepts only the supported ranges", () => {
    expect(isChartRange("90d")).toBe(true);
    expect(isChartRange("1y")).toBe(false);
  });
});

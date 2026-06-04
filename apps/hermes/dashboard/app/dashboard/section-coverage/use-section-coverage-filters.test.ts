import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSectionCoverageFilters } from "./use-section-coverage-filters";

const pushMock = vi.fn();
const searchParamsMock = new URLSearchParams("foo=bar");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

describe("useSectionCoverageFilters", () => {
  it("initializes inputs from server props", () => {
    const { result } = renderHook(() =>
      useSectionCoverageFilters({
        tickerId: "ticker-1",
        windowDays: 14,
      }),
    );

    expect(result.current.inputTickerId).toBe("ticker-1");
    expect(result.current.inputWindowDays).toBe("14");
  });

  it("navigates with ticker and window query params on submit", () => {
    const { result } = renderHook(() =>
      useSectionCoverageFilters({
        tickerId: "",
        windowDays: 30,
      }),
    );

    act(() => {
      result.current.setInputTickerId("  abc  ");
      result.current.setInputWindowDays("7");
    });

    act(() => {
      result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/section-coverage?foo=bar&ticker=abc&window=7",
    );
  });
});

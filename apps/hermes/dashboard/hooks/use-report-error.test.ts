import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReportError } from "./use-report-error";

describe("useReportError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error once per error instance", () => {
    // Setup
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const firstError = new Error("first");
    const secondError = new Error("second");

    // Act
    const { rerender } = renderHook(({ error }) => useReportError(error), {
      initialProps: { error: firstError },
    });
    rerender({ error: firstError });
    rerender({ error: secondError });

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, firstError);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, secondError);
  });
});

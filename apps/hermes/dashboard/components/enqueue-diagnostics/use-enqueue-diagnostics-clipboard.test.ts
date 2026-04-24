/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useClipboardCopyFeedback,
  useKeyedClipboardCopyFeedback,
} from "./use-enqueue-diagnostics-clipboard";

describe("useKeyedClipboardCopyFeedback", () => {
  it("writes text and sets copiedKey", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() => useKeyedClipboardCopyFeedback());

    await act(async () => {
      await result.current.copyForKey("a", "hello");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copiedKey).toBe("a");
  });
});

describe("useClipboardCopyFeedback", () => {
  it("writes the bound text and toggles copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() =>
      useClipboardCopyFeedback('{"errors":[]}'),
    );

    await act(async () => {
      await result.current.copy();
    });

    expect(writeText).toHaveBeenCalledWith('{"errors":[]}');
    expect(result.current.copied).toBe(true);
  });
});

/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMarkdownClamp } from "./use-markdown-clamp";

describe("useMarkdownClamp", () => {
  it("returns the clamped prefix and exposes the expander when clamping engages", () => {
    const { result } = renderHook(() =>
      useMarkdownClamp("full body text", { visible: "full", clamped: true }),
    );

    expect(result.current.text).toBe("full");
    expect(result.current.showExpander).toBe(true);
    expect(result.current.expanded).toBe(false);
  });

  it("hides the expander and shows the full body when not clamped", () => {
    const { result } = renderHook(() =>
      useMarkdownClamp("full body", { visible: "full body", clamped: false }),
    );

    expect(result.current.text).toBe("full body");
    expect(result.current.showExpander).toBe(false);
    expect(result.current.expanded).toBe(false);
  });

  it("expands to the full body when toggle is called", () => {
    // Setup
    const { result } = renderHook(() =>
      useMarkdownClamp("full body text", { visible: "full", clamped: true }),
    );

    // Act
    act(() => {
      result.current.toggle();
    });

    // Assert
    expect(result.current.expanded).toBe(true);
    expect(result.current.text).toBe("full body text");
  });

  it("toggles back to the clamped prefix on a second toggle", () => {
    // Setup
    const { result } = renderHook(() =>
      useMarkdownClamp("full body text", { visible: "full", clamped: true }),
    );

    // Act
    act(() => {
      result.current.toggle();
    });
    act(() => {
      result.current.toggle();
    });

    // Assert
    expect(result.current.expanded).toBe(false);
    expect(result.current.text).toBe("full");
  });
});

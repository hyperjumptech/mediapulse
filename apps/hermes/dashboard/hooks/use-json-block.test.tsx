import React from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useJsonBlock } from "./use-json-block";

const stubBodyHeights = (scrollHeight: number, clientHeight: number) => {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(
    scrollHeight,
  );
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(
    clientHeight,
  );
};

const MeasuredBody = ({ value }: { value: unknown }) => {
  const { bodyRef, canExpand, toggleExpanded } = useJsonBlock(value);

  return (
    <div>
      <div ref={bodyRef} data-testid="body">
        <pre>{String(value)}</pre>
      </div>
      <output data-testid="can-expand">{String(canExpand)}</output>
      <button type="button" onClick={toggleExpanded}>
        Toggle
      </button>
    </div>
  );
};

class ResizeObserverSpy {
  static instances: ResizeObserverSpy[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: () => void) {
    ResizeObserverSpy.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }
}

describe("useJsonBlock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    ResizeObserverSpy.instances = [];
  });

  it("formats the value and wraps lines by default", () => {
    const { result } = renderHook(() => useJsonBlock({ a: 1 }));

    expect(result.current.formatted).toBe('{\n  "a": 1\n}');
    expect(result.current.isWrapped).toBe(true);
    expect(result.current.isExpanded).toBe(false);
    expect(result.current.canExpand).toBe(false);
  });

  it("returns null for an empty value", () => {
    const { result } = renderHook(() => useJsonBlock(undefined));

    expect(result.current.formatted).toBeNull();
  });

  it("toggles wrapping", () => {
    const { result } = renderHook(() => useJsonBlock({ a: 1 }));

    act(() => {
      result.current.setWrapped(false);
    });

    expect(result.current.isWrapped).toBe(false);
  });

  it("keeps the expand toggle available while expanded", () => {
    const { result } = renderHook(() => useJsonBlock({ a: 1 }));

    act(() => {
      result.current.toggleExpanded();
    });

    expect(result.current.isExpanded).toBe(true);
    expect(result.current.canExpand).toBe(true);
  });

  it("copies the formatted JSON", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { result } = renderHook(() => useJsonBlock({ a: 1 }));

    await act(async () => {
      await result.current.copyFormatted();
    });

    expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}');
    expect(result.current.copied).toBe(true);
  });

  it("does not copy when there is nothing to show", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { result } = renderHook(() => useJsonBlock(null));

    await act(async () => {
      await result.current.copyFormatted();
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.copied).toBe(false);
  });

  it("offers expansion when the body is taller than its cap", () => {
    stubBodyHeights(800, 384);

    render(<MeasuredBody value="long" />);

    expect(screen.getByTestId("can-expand")).toHaveTextContent("true");
  });

  it("does not offer expansion when the body fits", () => {
    stubBodyHeights(200, 200);

    render(<MeasuredBody value="short" />);

    expect(screen.getByTestId("can-expand")).toHaveTextContent("false");
  });

  it("re-measures when the body or its content resizes", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverSpy);
    stubBodyHeights(200, 200);
    render(<MeasuredBody value="grows" />);
    const observer = ResizeObserverSpy.instances[0];
    const body = screen.getByTestId("body");

    stubBodyHeights(800, 384);
    act(() => {
      observer?.callback();
    });

    expect(observer?.observed).toEqual([body, body.firstElementChild]);
    expect(screen.getByTestId("can-expand")).toHaveTextContent("true");
  });

  it("stops observing while expanded and on unmount", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverSpy);
    stubBodyHeights(800, 384);
    const { unmount } = render(<MeasuredBody value="long" />);

    act(() => {
      screen.getByRole("button", { name: "Toggle" }).click();
    });
    const disconnectedWhileExpanded =
      ResizeObserverSpy.instances[0]?.disconnected;
    act(() => {
      screen.getByRole("button", { name: "Toggle" }).click();
    });
    unmount();

    expect(disconnectedWhileExpanded).toBe(true);
    expect(ResizeObserverSpy.instances).toHaveLength(2);
    expect(ResizeObserverSpy.instances[1]?.disconnected).toBe(true);
  });
});

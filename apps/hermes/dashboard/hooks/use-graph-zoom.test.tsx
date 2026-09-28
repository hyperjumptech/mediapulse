import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GraphSceneBounds } from "@/components/detail-blocks/graph/build-graph-scene";

import {
  GRAPH_SCROLL_HINT_MILLISECONDS,
  graphWheelDelta,
  isGraphZoomGesture,
  useGraphZoom,
  visibleGraphRegion,
  type UseGraphZoomResult,
} from "./use-graph-zoom";

const bounds: GraphSceneBounds = {
  minX: -100,
  minY: -50,
  width: 200,
  height: 100,
};

const renderZoom = () => {
  const latest: { current: UseGraphZoomResult | null } = { current: null };
  const ZoomHarness = () => {
    const zoom = useGraphZoom(bounds);
    latest.current = zoom;

    return (
      <svg ref={zoom.svgRef} data-testid="svg">
        <g ref={zoom.viewportRef} data-testid="viewport" />
      </svg>
    );
  };
  const view = render(<ZoomHarness />);
  const zoom = () => {
    if (!latest.current) {
      throw new Error("zoom hook did not render");
    }

    return latest.current;
  };

  return { ...view, zoom };
};

const viewportTransform = (container: HTMLElement) =>
  container.querySelector("[data-testid=viewport]")?.getAttribute("transform");

describe("useGraphZoom", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the fitted view without touching the viewport", () => {
    const { container, zoom } = renderZoom();

    expect(viewportTransform(container)).toBeNull();
    expect(zoom().level).toBe("normal");
    expect(zoom().isScrollHintVisible).toBe(false);
  });

  it("zooms in and out by a fixed step and fits back to the whole graph", () => {
    const { container, zoom } = renderZoom();

    act(() => zoom().zoomIn());

    expect(viewportTransform(container)).toContain("scale(1.25)");
    expect(zoom().level).toBe("detailed");

    act(() => zoom().fit());

    expect(viewportTransform(container)).toBe("translate(0,0) scale(1)");
    expect(zoom().level).toBe("normal");

    act(() => zoom().zoomOut());

    expect(viewportTransform(container)).toContain("scale(0.8)");
    expect(zoom().level).toBe("normal");

    act(() => zoom().zoomOut());

    expect(zoom().level).toBe("compact");
  });

  it("keeps the zoom between 0.2x and 4x", () => {
    const { container, zoom } = renderZoom();

    act(() => {
      for (let step = 0; step < 20; step += 1) {
        zoom().zoomIn();
      }
    });

    expect(viewportTransform(container)).toContain("scale(4)");

    act(() => {
      for (let step = 0; step < 40; step += 1) {
        zoom().zoomOut();
      }
    });

    expect(viewportTransform(container)).toContain("scale(0.2)");
  });

  it("zooms on a wheel only while Ctrl or Command is held", () => {
    const { container, getByTestId } = renderZoom();
    const svg = getByTestId("svg");

    fireEvent.wheel(svg, { deltaY: 100, metaKey: true });

    expect(viewportTransform(container)).toMatch(/scale\(0\.87\d*\)/);

    fireEvent.wheel(svg, { deltaY: -100, ctrlKey: true });

    expect(viewportTransform(container)).toMatch(/scale\(1\.23\d*\)/);
  });

  it("leaves a plain scroll to the page and shows the hint once", () => {
    vi.useFakeTimers();
    const { container, getByTestId, zoom } = renderZoom();
    const svg = getByTestId("svg");
    const plainScroll = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      svg.dispatchEvent(plainScroll);
    });

    expect(plainScroll.defaultPrevented).toBe(false);
    expect(viewportTransform(container)).toBeNull();
    expect(zoom().isScrollHintVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(GRAPH_SCROLL_HINT_MILLISECONDS);
    });

    expect(zoom().isScrollHintVisible).toBe(false);

    fireEvent.wheel(svg, { deltaY: 120 });

    expect(zoom().isScrollHintVisible).toBe(false);
  });

  it("pans to a point that sits outside the visible area", () => {
    const { container, zoom } = renderZoom();

    act(() => zoom().reveal({ x: 0, y: 0 }));

    expect(viewportTransform(container)).toBeNull();

    act(() => zoom().reveal({ x: 400, y: 300 }));

    expect(viewportTransform(container)).toBe("translate(-400,-300) scale(1)");
  });
});

describe("isGraphZoomGesture", () => {
  it("accepts a modified wheel, a two-finger touch and a primary mouse drag", () => {
    expect(isGraphZoomGesture(new WheelEvent("wheel", { ctrlKey: true }))).toBe(
      true,
    );
    expect(isGraphZoomGesture(new WheelEvent("wheel", { metaKey: true }))).toBe(
      true,
    );
    expect(
      isGraphZoomGesture(
        Object.assign(new Event("touchstart"), { touches: [{}, {}] }),
      ),
    ).toBe(true);
    expect(isGraphZoomGesture(new MouseEvent("mousedown", { button: 0 }))).toBe(
      true,
    );
  });

  it("rejects a plain wheel, a one-finger touch and other mouse buttons", () => {
    expect(isGraphZoomGesture(new WheelEvent("wheel"))).toBe(false);
    expect(
      isGraphZoomGesture(
        Object.assign(new Event("touchstart"), { touches: [{}] }),
      ),
    ).toBe(false);
    expect(isGraphZoomGesture(new MouseEvent("mousedown", { button: 2 }))).toBe(
      false,
    );
    expect(
      isGraphZoomGesture(
        new MouseEvent("mousedown", { button: 0, ctrlKey: true }),
      ),
    ).toBe(false);
    expect(isGraphZoomGesture(new MouseEvent("dblclick"))).toBe(false);
  });
});

describe("graphWheelDelta", () => {
  it("scales a trackpad pinch and caps a single mouse-wheel notch", () => {
    const pinch = graphWheelDelta(
      new WheelEvent("wheel", { deltaY: -4, ctrlKey: true }),
    );
    const notch = graphWheelDelta(
      new WheelEvent("wheel", { deltaY: 100, ctrlKey: true }),
    );
    const line = graphWheelDelta(
      new WheelEvent("wheel", { deltaY: -3, deltaMode: 1, metaKey: true }),
    );

    expect(pinch).toBeCloseTo(0.08);
    expect(notch).toBe(-0.5);
    expect(line).toBeCloseTo(0.15);
  });
});

describe("visibleGraphRegion", () => {
  it("widens the fitted bounds to the frame's aspect ratio", () => {
    const region = visibleGraphRegion(bounds, { width: 800, height: 200 });

    expect(region).toEqual({
      minX: -200,
      minY: -50,
      width: 400,
      height: 100,
      pixelsPerUnit: 2,
    });
  });

  it("falls back to the bounds when the frame has no size yet", () => {
    expect(visibleGraphRegion(bounds, { width: 0, height: 0 })).toEqual({
      ...bounds,
      pixelsPerUnit: 1,
    });
  });
});

import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  zoomTransform,
  type D3ZoomEvent,
  type ZoomBehavior,
} from "d3-zoom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { GraphSceneBounds } from "@/components/detail-blocks/graph/build-graph-scene";
import {
  graphZoomLevelFor,
  type GraphZoomLevel,
} from "@/components/detail-blocks/graph/graph-presentation";

export const GRAPH_MIN_ZOOM = 0.2;
export const GRAPH_MAX_ZOOM = 4;
export const GRAPH_ZOOM_STEP = 1.25;
export const GRAPH_SCROLL_HINT_MILLISECONDS = 1600;
export const GRAPH_WHEEL_DELTA_LIMIT = 0.5;
export const GRAPH_REVEAL_MARGIN_PIXELS = 32;

type GraphZoomBehavior = ZoomBehavior<SVGSVGElement, unknown>;

type GraphZoomEvent = D3ZoomEvent<SVGSVGElement, unknown>;

export type GraphPoint = {
  x: number;
  y: number;
};

export type UseGraphZoomResult = {
  svgRef: RefObject<SVGSVGElement | null>;
  viewportRef: RefObject<SVGGElement | null>;
  level: GraphZoomLevel;
  isScrollHintVisible: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reveal: (point: GraphPoint) => void;
};

export const isGraphZoomGesture = (event: Event): boolean => {
  if (event.type === "wheel") {
    const wheelEvent = event as WheelEvent;

    return wheelEvent.ctrlKey || wheelEvent.metaKey;
  }
  if (event.type === "touchstart") {
    const touchEvent = event as TouchEvent;

    return touchEvent.touches.length >= 2;
  }
  if (event.type === "mousedown") {
    const mouseEvent = event as MouseEvent;

    return mouseEvent.button === 0 && !mouseEvent.ctrlKey;
  }

  return false;
};

export const graphWheelDelta = (event: WheelEvent): number => {
  const lineOrPageUnit = event.deltaMode === 1 ? 0.05 : 1;
  const unit = event.deltaMode === 0 ? 0.002 : lineOrPageUnit;
  const pinchBoost = event.ctrlKey ? 10 : 1;
  const delta = -event.deltaY * unit * pinchBoost;

  return Math.max(
    -GRAPH_WHEEL_DELTA_LIMIT,
    Math.min(GRAPH_WHEEL_DELTA_LIMIT, delta),
  );
};

export const visibleGraphRegion = (
  bounds: GraphSceneBounds,
  frame: { width: number; height: number },
): GraphSceneBounds & { pixelsPerUnit: number } => {
  if (frame.width <= 0 || frame.height <= 0) {
    return { ...bounds, pixelsPerUnit: 1 };
  }
  const pixelsPerUnit = Math.min(
    frame.width / bounds.width,
    frame.height / bounds.height,
  );
  const width = frame.width / pixelsPerUnit;
  const height = frame.height / pixelsPerUnit;

  return {
    minX: bounds.minX - (width - bounds.width) / 2,
    minY: bounds.minY - (height - bounds.height) / 2,
    width,
    height,
    pixelsPerUnit,
  };
};

export const useGraphZoom = (bounds: GraphSceneBounds): UseGraphZoomResult => {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const behaviorRef = useRef<GraphZoomBehavior | null>(null);
  const scrollHintShownRef = useRef(false);
  const [level, setLevel] = useState<GraphZoomLevel>("normal");
  const [isScrollHintVisible, setScrollHintVisible] = useState(false);
  const { minX, minY, width, height } = bounds;

  useEffect(() => {
    const svg = svgRef.current;
    const viewport = viewportRef.current;
    if (!svg || !viewport) {
      return undefined;
    }
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const showScrollHint = () => {
      if (scrollHintShownRef.current) {
        return;
      }
      scrollHintShownRef.current = true;
      setScrollHintVisible(true);
      hintTimer = setTimeout(
        () => setScrollHintVisible(false),
        GRAPH_SCROLL_HINT_MILLISECONDS,
      );
    };
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM])
      .extent([
        [minX, minY],
        [minX + width, minY + height],
      ])
      .filter((event: Event) => {
        const accepted = isGraphZoomGesture(event);
        if (!accepted && event.type === "wheel") {
          showScrollHint();
        }

        return accepted;
      })
      .wheelDelta(graphWheelDelta)
      .on("zoom", (event: GraphZoomEvent) => {
        viewport.setAttribute("transform", event.transform.toString());
        setLevel(graphZoomLevelFor(event.transform.k));
      });
    const svgSelection = select(svg);
    svgSelection.call(behavior).on("dblclick.zoom", null);
    behaviorRef.current = behavior;

    return () => {
      clearTimeout(hintTimer);
      setScrollHintVisible(false);
      behavior.transform(svgSelection, zoomIdentity);
      svgSelection.on(".zoom", null);
      behaviorRef.current = null;
    };
  }, [minX, minY, width, height]);

  const withBehavior = useCallback(
    (apply: (behavior: GraphZoomBehavior, svg: SVGSVGElement) => void) => {
      const svg = svgRef.current;
      const behavior = behaviorRef.current;
      if (svg && behavior) {
        apply(behavior, svg);
      }
    },
    [],
  );

  const zoomIn = useCallback(
    () =>
      withBehavior((behavior, svg) =>
        behavior.scaleBy(select(svg), GRAPH_ZOOM_STEP),
      ),
    [withBehavior],
  );

  const zoomOut = useCallback(
    () =>
      withBehavior((behavior, svg) =>
        behavior.scaleBy(select(svg), 1 / GRAPH_ZOOM_STEP),
      ),
    [withBehavior],
  );

  const fit = useCallback(
    () =>
      withBehavior((behavior, svg) =>
        behavior.transform(select(svg), zoomIdentity),
      ),
    [withBehavior],
  );

  const reveal = useCallback(
    (point: GraphPoint) =>
      withBehavior((behavior, svg) => {
        const frame = svg.getBoundingClientRect();
        const region = visibleGraphRegion(
          { minX, minY, width, height },
          { width: frame.width, height: frame.height },
        );
        const margin = Math.min(
          GRAPH_REVEAL_MARGIN_PIXELS / region.pixelsPerUnit,
          region.width / 4,
          region.height / 4,
        );
        const [shownX, shownY] = zoomTransform(svg).apply([point.x, point.y]);
        const isVisible =
          shownX >= region.minX + margin &&
          shownX <= region.minX + region.width - margin &&
          shownY >= region.minY + margin &&
          shownY <= region.minY + region.height - margin;
        if (!isVisible) {
          behavior.translateTo(select(svg), point.x, point.y);
        }
      }),
    [withBehavior, minX, minY, width, height],
  );

  return {
    svgRef,
    viewportRef,
    level,
    isScrollHintVisible,
    zoomIn,
    zoomOut,
    fit,
    reveal,
  };
};

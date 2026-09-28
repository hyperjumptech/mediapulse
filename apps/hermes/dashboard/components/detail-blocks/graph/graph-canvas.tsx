"use client";

import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import {
  useId,
  useMemo,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@workspace/ui/components/button";

import {
  GRAPH_NODE_ID_ATTRIBUTE,
  useGraphKeyboard,
} from "@/hooks/use-graph-keyboard";
import { useGraphSelection } from "@/hooks/use-graph-selection";
import { useGraphZoom } from "@/hooks/use-graph-zoom";

import type {
  GraphScene,
  GraphSceneEdge,
  GraphSceneNode,
} from "./build-graph-scene";
import {
  buildGraphEdgeGeometry,
  type GraphEdgeGeometry,
} from "./graph-edge-geometry";
import { GraphNodeDetails } from "./graph-node-details";
import {
  describeGraphNode,
  GRAPH_DIMMED_OPACITY,
  GRAPH_SLOT_COLOR,
  isGraphEdgeLabelVisible,
  isGraphNodeLabelVisible,
  truncateGraphLabel,
  type GraphEdgeEmphasis,
  type GraphNodeEmphasis,
} from "./graph-presentation";

export type GraphCanvasProps = {
  scene: GraphScene;
  title: string;
  maxHeight: number;
};

type PlacedGraphEdge = {
  edge: GraphSceneEdge;
  geometry: GraphEdgeGeometry;
};

const LABEL_HALO_STYLE: CSSProperties = {
  paintOrder: "stroke",
  stroke: "var(--card)",
  strokeWidth: 3,
  strokeLinejoin: "round",
};

const EDGE_LABEL_LIFT = -6;

const opacityFor = (emphasis: GraphNodeEmphasis | GraphEdgeEmphasis) =>
  emphasis === "dimmed" ? GRAPH_DIMMED_OPACITY : 1;

const placeEdges = (scene: GraphScene): PlacedGraphEdge[] => {
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]));

  return scene.edges.flatMap((edge) => {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) {
      return [];
    }

    return [
      { edge, geometry: buildGraphEdgeGeometry(source, target, edge.bend) },
    ];
  });
};

const GraphArrowMarker = ({ id, fill }: { id: string; fill: string }) => (
  <marker
    id={id}
    viewBox="0 0 10 10"
    refX={5}
    refY={5}
    markerWidth={8}
    markerHeight={8}
    markerUnits="userSpaceOnUse"
    orient="auto"
  >
    <path d="M 0 1 L 10 5 L 0 9 z" style={{ fill }} />
  </marker>
);

const GraphNodeMark = ({
  node,
  emphasis,
  isFocus,
  isActive,
  showLabel,
  onSelect,
  onFocus,
  onKeyDown,
}: {
  node: GraphSceneNode;
  emphasis: GraphNodeEmphasis;
  isFocus: boolean;
  isActive: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
  onFocus: (event: FocusEvent<SVGGElement>, id: string) => void;
  onKeyDown: (event: KeyboardEvent<SVGGElement>, id: string) => void;
}) => {
  const color = GRAPH_SLOT_COLOR[node.slot];
  const isSelected = emphasis === "selected";
  const focusRingRadius = node.radius + 3.5;
  const selectedRingRadius = node.radius + (isFocus ? 8 : 4);
  const keyboardRingRadius = selectedRingRadius + 4;
  const labelOffset = node.radius + (isFocus ? 10 : 6);
  const nodeAttributes = { [GRAPH_NODE_ID_ATTRIBUTE]: node.id };

  return (
    <g
      {...nodeAttributes}
      data-emphasis={emphasis}
      role="button"
      tabIndex={isActive ? 0 : -1}
      aria-label={describeGraphNode(node)}
      aria-current={isSelected ? "true" : undefined}
      transform={`translate(${String(node.x)} ${String(node.y)})`}
      className="group cursor-pointer outline-none transition-opacity motion-reduce:transition-none"
      style={{ opacity: opacityFor(emphasis) }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
      onFocus={(event) => onFocus(event, node.id)}
      onKeyDown={(event) => onKeyDown(event, node.id)}
    >
      <title>{node.label}</title>
      <circle
        r={keyboardRingRadius}
        fill="none"
        strokeWidth={2}
        className="stroke-ring opacity-0 group-focus-visible:opacity-100"
      />
      {isSelected ? (
        <circle
          data-graph-ring="selected"
          r={selectedRingRadius}
          fill="none"
          strokeWidth={2}
          style={{ stroke: "var(--foreground)" }}
        />
      ) : null}
      {isFocus ? (
        <circle
          data-graph-ring="focus"
          r={focusRingRadius}
          fill="none"
          strokeWidth={3}
          style={{ stroke: color }}
        />
      ) : null}
      <circle
        r={node.radius}
        strokeWidth={1.5}
        style={{ fill: color, stroke: "var(--card)" }}
      />
      {showLabel ? (
        <text
          y={labelOffset}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="fill-foreground text-xs font-medium"
          style={LABEL_HALO_STYLE}
        >
          {truncateGraphLabel(node.label)}
        </text>
      ) : null}
    </g>
  );
};

const GraphZoomControls = ({
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) => (
  <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1">
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Zoom in"
      aria-keyshortcuts="+"
      title="Zoom in (+)"
      onClick={onZoomIn}
    >
      <ZoomInIcon />
    </Button>
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Zoom out"
      aria-keyshortcuts="-"
      title="Zoom out (-)"
      onClick={onZoomOut}
    >
      <ZoomOutIcon />
    </Button>
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Fit graph"
      aria-keyshortcuts="0"
      title="Fit graph (0)"
      onClick={onFit}
    >
      <MaximizeIcon />
    </Button>
  </div>
);

export const GraphCanvas = ({ scene, title, maxHeight }: GraphCanvasProps) => {
  const instanceId = `graph-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleId = `${instanceId}-title`;
  const descriptionId = `${instanceId}-description`;
  const arrowId = `${instanceId}-arrow`;
  const activeArrowId = `${instanceId}-arrow-active`;
  const zoom = useGraphZoom(scene.bounds);
  const selection = useGraphSelection(scene.adjacency);
  const keyboard = useGraphKeyboard({
    nodes: scene.nodes,
    initialActiveId: scene.focusId,
    svgRef: zoom.svgRef,
    selectedId: selection.selectedId,
    onSelect: selection.select,
    onClear: selection.clear,
    onZoomIn: zoom.zoomIn,
    onZoomOut: zoom.zoomOut,
    onFit: zoom.fit,
    onReveal: zoom.reveal,
  });
  const placedEdges = useMemo(() => placeEdges(scene), [scene]);
  const nodesById = useMemo(
    () => new Map(scene.nodes.map((node) => [node.id, node])),
    [scene],
  );
  const selectedNode =
    selection.selectedId === null
      ? undefined
      : nodesById.get(selection.selectedId);
  const connections = selectedNode
    ? (scene.adjacency[selectedNode.id] ?? []).flatMap(
        (id) => nodesById.get(id) ?? [],
      )
    : [];
  const { bounds } = scene;
  const viewBox = [bounds.minX, bounds.minY, bounds.width, bounds.height]
    .map(String)
    .join(" ");
  const nodeNoun = scene.nodes.length === 1 ? "node" : "nodes";
  const edgeNoun = scene.edges.length === 1 ? "connection" : "connections";
  const description = `${String(scene.nodes.length)} ${nodeNoun} and ${String(scene.edges.length)} ${edgeNoun}`;
  const frameStyle = {
    "--graph-height": `${String(maxHeight)}px`,
  } as CSSProperties;

  const selectNode = (id: string) => {
    selection.select(id);
    keyboard.setActiveId(id);
  };

  const selectFromDetails = (id: string) => {
    selection.select(id);
    keyboard.focusNode(id);
  };

  const closeDetails = () => {
    const previousId = selection.selectedId;
    selection.clear();
    if (previousId !== null) {
      keyboard.focusNode(previousId);
    }
  };

  return (
    <div
      data-slot="graph-frame"
      className="bg-card relative h-[min(var(--graph-height),70vh)] w-full overflow-hidden rounded-lg border"
      style={frameStyle}
      onKeyDown={keyboard.handleFrameKeyDown}
    >
      <svg
        ref={zoom.svgRef}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        viewBox={viewBox}
        width="100%"
        height="100%"
        className="block cursor-grab touch-pan-x touch-pan-y select-none active:cursor-grabbing"
        onClick={selection.clear}
      >
        <title id={titleId}>{title}</title>
        <desc id={descriptionId}>{description}</desc>
        <defs>
          <GraphArrowMarker id={arrowId} fill="var(--muted-foreground)" />
          <GraphArrowMarker id={activeArrowId} fill="var(--foreground)" />
        </defs>
        <g ref={zoom.viewportRef}>
          <g>
            {placedEdges.map(({ edge, geometry }) => {
              const emphasis = selection.edgeEmphasis(edge);
              const isHighlighted = emphasis === "highlighted";

              return (
                <path
                  key={edge.key}
                  data-graph-edge={edge.key}
                  data-emphasis={emphasis}
                  d={geometry.path}
                  fill="none"
                  strokeWidth={isHighlighted ? 2 : 1.25}
                  markerMid={`url(#${isHighlighted ? activeArrowId : arrowId})`}
                  className="transition-opacity motion-reduce:transition-none"
                  style={{
                    stroke: isHighlighted
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                    strokeOpacity: isHighlighted ? 1 : 0.55,
                    opacity: opacityFor(emphasis),
                  }}
                />
              );
            })}
          </g>
          <g>
            {placedEdges.map(({ edge, geometry }) => {
              const emphasis = selection.edgeEmphasis(edge);
              const isVisible =
                edge.label !== undefined &&
                isGraphEdgeLabelVisible({ level: zoom.level, emphasis });
              if (!isVisible) {
                return null;
              }

              return (
                <text
                  key={edge.key}
                  data-graph-edge-label={edge.key}
                  transform={`translate(${String(geometry.midX)} ${String(geometry.midY)}) rotate(${String(geometry.labelAngle)})`}
                  y={EDGE_LABEL_LIFT}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                  style={{ ...LABEL_HALO_STYLE, opacity: opacityFor(emphasis) }}
                >
                  {edge.label}
                </text>
              );
            })}
          </g>
          <g>
            {scene.nodes.map((node) => {
              const emphasis = selection.nodeEmphasis(node.id);
              const isFocus = node.id === scene.focusId;

              return (
                <GraphNodeMark
                  key={node.id}
                  node={node}
                  emphasis={emphasis}
                  isFocus={isFocus}
                  isActive={node.id === keyboard.activeId}
                  showLabel={isGraphNodeLabelVisible({
                    level: zoom.level,
                    emphasis,
                    isFocus,
                    rank: node.rank,
                  })}
                  onSelect={selectNode}
                  onFocus={keyboard.handleNodeFocus}
                  onKeyDown={keyboard.handleNodeKeyDown}
                />
              );
            })}
          </g>
        </g>
      </svg>
      <GraphZoomControls
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        onFit={zoom.fit}
      />
      <div
        role="status"
        className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4"
      >
        {zoom.isScrollHintVisible ? (
          <span className="bg-foreground/85 text-background rounded-md px-2.5 py-1 text-xs shadow-sm">
            Hold Ctrl/⌘ to zoom
          </span>
        ) : null}
      </div>
      {selectedNode ? (
        <GraphNodeDetails
          node={selectedNode}
          connections={connections}
          onSelectNode={selectFromDetails}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
};

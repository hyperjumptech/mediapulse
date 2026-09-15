import {
  renderCaptionTemplate,
  type DetailBlockGraph,
  type DetailBlockGraphPaletteSlot,
} from "@hermes/domain-contract";

import { DetailBlockEmptyState } from "./detail-block-empty-state";
import {
  buildEdgeGeometry,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  placeGraphNodes,
  wrapGraphLabel,
  type GraphPlacedNode,
} from "./detail-block-graph-layout";
import { buildGraphModel } from "./detail-block-graph-model";
import { DetailBlockSectionHeader } from "./detail-block-section-header";

const PAINT_BY_SLOT: Record<
  DetailBlockGraphPaletteSlot,
  { stroke: string; fill: string }
> = {
  accent1: {
    stroke: "var(--chart-1)",
    fill: "color-mix(in oklab, var(--chart-1) 14%, transparent)",
  },
  accent2: {
    stroke: "var(--chart-2)",
    fill: "color-mix(in oklab, var(--chart-2) 14%, transparent)",
  },
  accent3: {
    stroke: "var(--chart-3)",
    fill: "color-mix(in oklab, var(--chart-3) 14%, transparent)",
  },
  accent4: {
    stroke: "var(--chart-4)",
    fill: "color-mix(in oklab, var(--chart-4) 14%, transparent)",
  },
  accent5: {
    stroke: "var(--chart-5)",
    fill: "color-mix(in oklab, var(--chart-5) 14%, transparent)",
  },
  neutral: { stroke: "var(--border)", fill: "var(--muted)" },
};

const LINE_HEIGHT = 13;
const NODE_LABEL_FONT_SIZE = 11;
const EDGE_LABEL_FONT_SIZE = 10;
const EDGE_LABEL_BOX_HEIGHT = 14;
const EDGE_LABEL_CHAR_WIDTH = 5.6;
const EDGE_LABEL_BOX_PADDING = 8;

const edgeLabelWidth = (label: string): number =>
  label.length * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_BOX_PADDING;

const slugify = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "graph";

export const DetailBlockGraphView = ({
  block,
  data,
}: {
  block: DetailBlockGraph;
  data: unknown;
}) => {
  const model = buildGraphModel(block, data);

  if (model.nodes.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <DetailBlockSectionHeader
          label={block.label}
          sectionRule={block.sectionRule}
          data={data}
        />
        <DetailBlockEmptyState
          message={block.emptyState ?? "No graph data to draw."}
        />
      </section>
    );
  }

  const placement = placeGraphNodes(
    model.nodes.map((node) => ({ id: node.id, rank: node.rank })),
    block.orientation,
  );
  const placedById = new Map<string, GraphPlacedNode>(
    placement.placed.map((node) => [node.id, node]),
  );
  const outgoingLabels = new Map<string, string[]>();
  for (const edge of model.edges) {
    const labels = outgoingLabels.get(edge.source) ?? [];
    const target = model.nodes.find((node) => node.id === edge.target);
    labels.push(target?.label ?? edge.target);
    outgoingLabels.set(edge.source, labels);
  }

  const domId = slugify(block.nodesField);
  const titleId = `${domId}-graph-title`;
  const descriptionId = `${domId}-graph-desc`;
  const caption = block.captionTemplate
    ? renderCaptionTemplate(block.captionTemplate, data)
    : undefined;
  const overflowNote =
    model.droppedNodes > 0
      ? `Showing ${String(model.nodes.length)} of ${String(model.totalNodes)} nodes.`
      : undefined;
  const captionLine = [caption, overflowNote]
    .filter((part): part is string => part !== undefined && part.trim() !== "")
    .join(" ");

  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <div
        className="bg-card overflow-auto rounded-md border"
        style={{ maxHeight: block.maxHeight }}
      >
        <svg
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          width={placement.width}
          height={placement.height}
          viewBox={`0 0 ${String(placement.width)} ${String(placement.height)}`}
        >
          <title id={titleId}>{block.label ?? "Graph"}</title>
          <desc id={descriptionId}>
            {`${String(model.nodes.length)} ${model.nodes.length === 1 ? "node" : "nodes"} and ${String(model.edges.length)} ${model.edges.length === 1 ? "connection" : "connections"}`}
          </desc>
          <g>
            {model.edges.map((edge) => {
              const from = placedById.get(edge.source);
              const to = placedById.get(edge.target);
              if (!from || !to) return null;
              const geometry = buildEdgeGeometry(from, to, block.orientation);

              return (
                <g key={edge.key}>
                  <path
                    d={geometry.path}
                    fill="none"
                    strokeWidth={1.5}
                    style={{ stroke: "var(--border)" }}
                  />
                  {edge.label ? (
                    <g>
                      <rect
                        x={geometry.midX - edgeLabelWidth(edge.label) / 2}
                        y={geometry.midY - EDGE_LABEL_BOX_HEIGHT / 2}
                        width={edgeLabelWidth(edge.label)}
                        height={EDGE_LABEL_BOX_HEIGHT}
                        rx={3}
                        style={{ fill: "var(--card)" }}
                      />
                      <text
                        x={geometry.midX}
                        y={geometry.midY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fontSize: EDGE_LABEL_FONT_SIZE,
                          fill: "var(--muted-foreground)",
                        }}
                      >
                        {edge.label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </g>
          <g>
            {model.nodes.map((node) => {
              const placed = placedById.get(node.id);
              if (!placed) return null;
              const paint = PAINT_BY_SLOT[node.slot];
              const lines = wrapGraphLabel(node.label);
              const firstLineY =
                GRAPH_NODE_HEIGHT / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2;
              const body = (
                <g
                  transform={`translate(${String(placed.x)}, ${String(placed.y)})`}
                >
                  <title>
                    {node.tooltip
                      ? `${node.label} — ${node.tooltip}`
                      : node.label}
                  </title>
                  <rect
                    width={GRAPH_NODE_WIDTH}
                    height={GRAPH_NODE_HEIGHT}
                    rx={8}
                    strokeWidth={node.emphasis ? 2 : 1}
                    style={{ fill: paint.fill, stroke: paint.stroke }}
                  />
                  <text
                    x={GRAPH_NODE_WIDTH / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: NODE_LABEL_FONT_SIZE,
                      fontWeight: 500,
                      fill: "var(--foreground)",
                    }}
                  >
                    {lines.map((line, lineIndex) => (
                      <tspan
                        key={line}
                        x={GRAPH_NODE_WIDTH / 2}
                        y={firstLineY + lineIndex * LINE_HEIGHT}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );

              if (node.href === undefined) {
                return <g key={node.id}>{body}</g>;
              }

              return (
                <a
                  key={node.id}
                  href={node.href}
                  target={node.external ? "_blank" : undefined}
                  rel={node.external ? "noopener noreferrer" : undefined}
                >
                  {body}
                </a>
              );
            })}
          </g>
        </svg>
      </div>
      <ul className="sr-only">
        {model.nodes.map((node) => {
          const targets = outgoingLabels.get(node.id) ?? [];

          return (
            <li key={node.id}>
              {[
                node.label,
                node.group ? ` (${node.group})` : "",
                targets.length > 0 ? `, connects to ${targets.join(", ")}` : "",
              ].join("")}
            </li>
          );
        })}
      </ul>
      {model.groups.length > 1 ? (
        <ul className="flex list-none flex-wrap gap-x-4 gap-y-1">
          {model.groups.map((group) => {
            const slot = model.nodes.find((node) => node.group === group)?.slot;
            const paint = PAINT_BY_SLOT[slot ?? "neutral"];

            return (
              <li
                key={group}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-sm border"
                  style={{ background: paint.fill, borderColor: paint.stroke }}
                />
                {group}
              </li>
            );
          })}
        </ul>
      ) : null}
      {captionLine.length > 0 ? (
        <p className="text-muted-foreground text-xs">{captionLine}</p>
      ) : null}
    </section>
  );
};

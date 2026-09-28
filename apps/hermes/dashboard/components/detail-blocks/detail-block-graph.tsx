import {
  renderCaptionTemplate,
  type DetailBlockGraph,
} from "@hermes/domain-contract";

import { DetailBlockEmptyState } from "./detail-block-empty-state";
import { buildGraphModel, type GraphModel } from "./detail-block-graph-model";
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { buildGraphScene, type GraphScene } from "./graph/build-graph-scene";
import { GraphCanvas } from "./graph/graph-canvas";
import { GRAPH_SLOT_COLOR } from "./graph/graph-presentation";

export type DetailBlockGraphContentProps = {
  block: DetailBlockGraph;
  data: unknown;
  model: GraphModel;
  scene: GraphScene;
};

export const DetailBlockGraphContent = ({
  block,
  data,
  model,
  scene,
}: DetailBlockGraphContentProps) => {
  if (model.nodes.length === 0) {
    return (
      <section className="flex min-w-0 flex-col gap-4">
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

  const labelById = new Map(model.nodes.map((node) => [node.id, node.label]));
  const outgoingLabels = new Map<string, string[]>();
  for (const edge of model.edges) {
    const labels = outgoingLabels.get(edge.source) ?? [];
    labels.push(labelById.get(edge.target) ?? edge.target);
    outgoingLabels.set(edge.source, labels);
  }
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
    <section className="flex min-w-0 flex-col gap-4">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <GraphCanvas
        scene={scene}
        title={block.label ?? "Graph"}
        maxHeight={block.maxHeight}
      />
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

            return (
              <li
                key={group}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: GRAPH_SLOT_COLOR[slot ?? "neutral"] }}
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

export const DetailBlockGraphView = ({
  block,
  data,
}: {
  block: DetailBlockGraph;
  data: unknown;
}) => {
  const model = buildGraphModel(block, data);
  const scene = buildGraphScene(model);

  return (
    <DetailBlockGraphContent
      block={block}
      data={data}
      model={model}
      scene={scene}
    />
  );
};

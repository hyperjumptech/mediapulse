"use client";

import type { DetailBlockGraph } from "@hermes/domain-contract";
import { useMemo } from "react";

import { DetailBlockGraphContent } from "./detail-block-graph";
import { buildGraphModel } from "./detail-block-graph-model";
import { buildGraphScene } from "./graph/build-graph-scene";

export const DetailBlockGraphClientView = ({
  block,
  data,
}: {
  block: DetailBlockGraph;
  data: unknown;
}) => {
  const model = useMemo(() => buildGraphModel(block, data), [block, data]);
  const scene = useMemo(() => buildGraphScene(model), [model]);

  return (
    <DetailBlockGraphContent
      block={block}
      data={data}
      model={model}
      scene={scene}
    />
  );
};

import type { DetailBlock } from "@hermes/domain-contract";

import { DetailBlockHtmlPreviewView } from "./detail-block-html-preview";
import { DetailBlockKeyValueView } from "./detail-block-key-value";
import { DetailBlockMarkdownView } from "./detail-block-markdown";
import { DetailBlockSubTableView } from "./detail-block-sub-table";

/**
 * Renders a single detail block based on its discriminant `type`. Throws for
 * unknown types so a misconfigured manifest fails loudly during development.
 *
 * @param props.block - Manifest block definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockView = ({
  block,
  data,
}: {
  block: DetailBlock;
  data: unknown;
}) => {
  if (block.type === "keyValue") {
    return <DetailBlockKeyValueView block={block} data={data} />;
  }
  if (block.type === "markdown") {
    return <DetailBlockMarkdownView block={block} data={data} />;
  }
  if (block.type === "htmlPreview") {
    return <DetailBlockHtmlPreviewView block={block} data={data} />;
  }
  if (block.type === "subTable") {
    return <DetailBlockSubTableView block={block} data={data} />;
  }
  // Exhaustive check — also satisfies the AC false-positive guard.
  const exhaustive: never = block;
  throw new Error(`Unknown detail block type: ${JSON.stringify(exhaustive)}`);
};

/**
 * Renders an ordered list of detail blocks. Convenience wrapper around
 * {@link DetailBlockView}.
 *
 * @param props.blocks - Manifest block list, in render order.
 * @param props.data - Detail response object.
 */
export const DetailBlocksView = ({
  blocks,
  data,
}: {
  blocks: readonly DetailBlock[];
  data: unknown;
}) => (
  <div className="flex flex-col gap-8">
    {blocks.map((block, index) => (
      <DetailBlockView
        key={`${block.type}-${index}`}
        block={block}
        data={data}
      />
    ))}
  </div>
);

import type { DetailBlock } from "@hermes/domain-contract";

import { Card } from "@workspace/ui/components/card";

import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockGraphView } from "./detail-block-graph";
import { DetailBlockHtmlPreviewView } from "./detail-block-html-preview";
import { DetailBlockKeyValueView } from "./detail-block-key-value";
import { DetailBlockMarkdownView } from "./detail-block-markdown";
import { DetailBlockStatCardsView } from "./detail-block-stat-cards";
import { DetailBlockSubTableView } from "./detail-block-sub-table";
import { DetailBlockTabsView } from "./detail-block-tabs";

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
  if (block.type === "statCards") {
    return <DetailBlockStatCardsView block={block} data={data} />;
  }
  if (block.type === "graph") {
    return <DetailBlockGraphView block={block} data={data} />;
  }
  if (block.type === "panel") {
    return (
      <Card className="min-w-0 gap-4 p-4 shadow-none">
        <DetailBlockSectionHeader
          label={block.label}
          sectionRule={block.sectionRule}
          data={data}
        />
        <div className="flex min-w-0 flex-col gap-6">
          {block.blocks.map((child, index) => (
            <DetailBlockView
              key={`${child.type}-${String(index)}`}
              block={child}
              data={data}
            />
          ))}
        </div>
      </Card>
    );
  }
  if (block.type === "tabs") {
    return <DetailBlockTabsView block={block} data={data} />;
  }
  const exhaustive: never = block;
  throw new Error(`Unknown detail block type: ${JSON.stringify(exhaustive)}`);
};

export const DetailBlocksView = ({
  blocks,
  data,
}: {
  blocks: readonly DetailBlock[];
  data: unknown;
}) => (
  <div className="flex min-w-0 flex-col gap-6">
    {blocks.map((block, index) => (
      <DetailBlockView
        key={`${block.type}-${index}`}
        block={block}
        data={data}
      />
    ))}
  </div>
);

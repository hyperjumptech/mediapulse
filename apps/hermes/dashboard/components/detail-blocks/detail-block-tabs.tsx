"use client";

import type { DetailBlockLeaf, DetailBlockTabs } from "@hermes/domain-contract";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockHtmlPreviewView } from "./detail-block-html-preview";
import { DetailBlockKeyValueView } from "./detail-block-key-value";
import { DetailBlockMarkdownView } from "./detail-block-markdown";
import { DetailBlockSubTableView } from "./detail-block-sub-table";

const renderLeafBlock = (block: DetailBlockLeaf, data: unknown) => {
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
  const exhaustive: never = block;
  throw new Error(`Unknown tab block type: ${JSON.stringify(exhaustive)}`);
};

const stripLabel = <T extends DetailBlockLeaf>(block: T): T => ({
  ...block,
  label: undefined,
});

/**
 * Renders a `tabs` detail block — groups one or more leaf blocks under a
 * tabbed section. The outer block's `label` and section-rule badge render
 * above the tab list; each tab's inner block has its own `label` stripped so
 * the tab trigger acts as the heading instead.
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockTabsView = ({
  block,
  data,
}: {
  block: DetailBlockTabs;
  data: unknown;
}) => {
  const firstValue = `tab-0`;
  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <Tabs defaultValue={firstValue} className="gap-4">
        <TabsList>
          {block.tabs.map((tab, index) => (
            <TabsTrigger key={`tab-trigger-${index}`} value={`tab-${index}`}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {block.tabs.map((tab, index) => (
          <TabsContent key={`tab-content-${index}`} value={`tab-${index}`}>
            {renderLeafBlock(stripLabel(tab.block), data)}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
};

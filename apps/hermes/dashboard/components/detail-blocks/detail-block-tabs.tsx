"use client";

import { useState } from "react";

import {
  resolvePath,
  type DetailBlockLeaf,
  type DetailBlockSubTable,
  type DetailBlockTabs,
} from "@hermes/domain-contract";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
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
import {
  DetailBlockSubTableContent,
  DetailBlockSubTableView,
} from "./detail-block-sub-table";

const ALL_VALUE = "all";

const stripLabel = <T extends DetailBlockLeaf>(block: T): T => ({
  ...block,
  label: undefined,
});

const defaultLimitValue = (block: DetailBlockSubTable): string =>
  block.rowLimitDefaultAll ? ALL_VALUE : String(block.rowLimitOptions?.[0]);

const rowsForField = (
  data: unknown,
  field: string,
): Record<string, unknown>[] => {
  const raw = resolvePath(data, field);
  return Array.isArray(raw)
    ? raw.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null,
      )
    : [];
};

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

/**
 * Renders one tab's content. A `subTable` with `rowLimitOptions` is rendered without its own
 * selector (the selector lives on the tab bar); its rows are sliced to `limitValue`. Every other
 * leaf block renders as-is.
 */
const renderTabBody = (
  block: DetailBlockLeaf,
  data: unknown,
  limitValue: string,
) => {
  if (block.type === "subTable" && block.rowLimitOptions) {
    const rows = rowsForField(data, block.field);
    if (rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {block.emptyState ?? "No items."}
        </p>
      );
    }
    const limit = limitValue === ALL_VALUE ? rows.length : Number(limitValue);
    return (
      <DetailBlockSubTableContent
        columns={block.columns}
        rows={rows.slice(0, limit)}
        rowContext={data}
        hideHeader={block.hideHeader}
      />
    );
  }

  return renderLeafBlock(block, data);
};

/**
 * Renders a `tabs` detail block — groups one or more leaf blocks under a tabbed section. The outer
 * block's `label` and section-rule badge render above the tab list; each tab's inner block has its
 * own `label` stripped so the tab trigger acts as the heading instead. When the active tab is a
 * `subTable` with `rowLimitOptions`, its row-count selector renders on the right of the tab bar.
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [limitByTab, setLimitByTab] = useState<Record<number, string>>({});

  const limitFor = (tabIndex: number, tabBlock: DetailBlockLeaf): string =>
    tabBlock.type === "subTable" && tabBlock.rowLimitOptions
      ? (limitByTab[tabIndex] ?? defaultLimitValue(tabBlock))
      : ALL_VALUE;

  const activeBlock = block.tabs[activeIndex]?.block;
  const activeOptions =
    activeBlock?.type === "subTable" ? activeBlock.rowLimitOptions : undefined;

  return (
    <section className="flex flex-col gap-3">
      <DetailBlockSectionHeader
        label={block.label}
        sectionRule={block.sectionRule}
        data={data}
      />
      <Tabs
        value={`tab-${activeIndex}`}
        onValueChange={(value) =>
          setActiveIndex(Number(value.slice("tab-".length)))
        }
        className="gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            {block.tabs.map((tab, index) => (
              <TabsTrigger key={`tab-trigger-${index}`} value={`tab-${index}`}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {activeOptions ? (
            <Select
              value={limitFor(activeIndex, activeBlock as DetailBlockLeaf)}
              onValueChange={(value) =>
                setLimitByTab((prev) => ({ ...prev, [activeIndex]: value }))
              }
            >
              <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value={ALL_VALUE}>All</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {block.tabs.map((tab, index) => {
          const tabBlock = stripLabel(tab.block);
          return (
            <TabsContent key={`tab-content-${index}`} value={`tab-${index}`}>
              {renderTabBody(tabBlock, data, limitFor(index, tabBlock))}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
};

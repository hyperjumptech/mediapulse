/** @vitest-environment node */
import {
  detailBlockSchema,
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  resolvePath,
  type DetailBlock,
} from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { storylinesDashboardPage } from "./dashboard-page";
import { mapRowToDetailItem, type StorylineDetailRow } from "./detail-mapper";

const detailBlocks = storylinesDashboardPage.detailBlocks ?? [];

const sampleDetail = () => {
  const row = {
    id: "s1",
    name: "Contract delay",
    kind: "story",
    locked: true,
    lockedReason: "ticker ceiling",
    lockedAt: new Date("2026-04-18T00:00:00.000Z"),
    firstObservedAt: new Date("2026-03-02T00:00:00.000Z"),
    lastObservedAt: new Date("2026-04-18T00:00:00.000Z"),
    createdAt: new Date("2026-03-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-18T00:00:00.000Z"),
    anchors: [{ anchor: "contract" }],
    tickers: [
      {
        tickerId: "t1",
        source: "placement",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
        ticker: { symbol: "FORE", name: "Foresta" },
      },
    ],
    developments: [
      {
        id: "d1",
        title: "Delay reported",
        observedAt: new Date("2026-03-02T00:00:00.000Z"),
        attachEvidence: null,
        ingestionRunId: "run-1",
        _count: { citations: 1 },
      },
    ],
  } as unknown as StorylineDetailRow;

  return mapRowToDetailItem(row, [
    {
      id: "c1",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
      developmentId: "d1",
      dataSourceId: "ds1",
      dataSource: {
        id: "ds1",
        title: "Regulator flags delay",
        url: "https://example.test/a",
        registrableDomain: "example.test",
        publishedAt: null,
      },
    },
  ] as never);
};

const findBlock = (label: string): DetailBlock => {
  const block = detailBlocks.find((entry) => entry.label === label);
  if (!block) throw new Error(`block not found: ${label}`);

  return block as DetailBlock;
};

describe("storylinesDashboardPage", () => {
  it("registers as a read-only sidebar table at order 45", () => {
    expect(storylinesDashboardPage.order).toBe(45);
    expect(storylinesDashboardPage.kind).toBe("resource-table");
    expect(storylinesDashboardPage.placement).toBe("sidebar");
    expect(storylinesDashboardPage.actions).toEqual({
      create: false,
      update: false,
      delete: false,
      view: true,
    });
  });

  it("parses every detail block against the shared contract", () => {
    for (const block of detailBlocks) {
      expect(() => detailBlockSchema.parse(block)).not.toThrow();
    }
  });

  it("declares a lock rule that fires only on a locked storyline", () => {
    const overview = findBlock("Storyline");
    const rule = overview.sectionRule;

    expect(rule).toMatchObject({ badge: "warning", label: "locked" });

    const ast = parseDetailBlockRule(rule?.when ?? "");

    expect(evaluateDetailBlockRule(ast, { locked: true })).toBe(true);
    expect(evaluateDetailBlockRule(ast, { locked: false })).toBe(false);
  });

  it("binds the graph block to the payload the detail mapper emits", () => {
    const graph = findBlock("Knowledge graph");
    if (graph.type !== "graph") throw new Error("expected a graph block");
    const detail = sampleDetail();

    expect(Array.isArray(resolvePath(detail, graph.nodesField))).toBe(true);
    expect(Array.isArray(resolvePath(detail, graph.edgesField))).toBe(true);

    const node = detail.graph.nodes[0];
    expect(resolvePath(node, graph.node.idField)).toBeDefined();
    expect(resolvePath(node, graph.node.labelField)).toBeDefined();
    expect(resolvePath(node, graph.node.rankField ?? "")).toBeDefined();
  });

  it("pins a palette slot for every group the builder emits", () => {
    const graph = findBlock("Knowledge graph");
    if (graph.type !== "graph") throw new Error("expected a graph block");
    const groups = new Set(
      sampleDetail().graph.nodes.map((node) => node.group),
    );

    for (const group of groups) {
      expect(graph.groupVariants?.[group]).toBeDefined();
    }
  });

  it("resolves every stat card and key-value field on the detail payload", () => {
    const overview = findBlock("Storyline");
    if (overview.type !== "panel") throw new Error("expected a panel block");
    const detail = sampleDetail();

    for (const child of overview.blocks) {
      if (child.type === "statCards") {
        for (const card of child.cards) {
          expect(resolvePath(detail, card.field)).toBeDefined();
        }
      }
      if (child.type === "keyValue") {
        for (const row of child.rows) {
          expect(resolvePath(detail, row.field)).not.toBeUndefined();
        }
      }
    }
  });

  it("binds every evidence tab to an array on the detail payload", () => {
    const evidence = findBlock("Evidence");
    if (evidence.type !== "tabs") throw new Error("expected a tabs block");
    const detail = sampleDetail();

    for (const tab of evidence.tabs) {
      if (tab.block.type !== "subTable") continue;
      expect(Array.isArray(resolvePath(detail, tab.block.field))).toBe(true);
      for (const column of tab.block.columns) {
        const firstRow = (resolvePath(detail, tab.block.field) as unknown[])[0];
        if (firstRow === undefined) continue;
        expect(resolvePath(firstRow, column.field)).not.toBeUndefined();
      }
    }
  });

  it("declares only columns and sort fields that exist on a list row", () => {
    const listKeys = new Set([
      "id",
      "name",
      "kind",
      "kindLabel",
      "lockedLabel",
      "developmentCount",
      "citationCount",
      "tickerCount",
      "tickerSymbols",
      "firstObservedAt",
      "lastObservedAt",
    ]);

    for (const column of storylinesDashboardPage.columns) {
      expect(listKeys.has(column.key)).toBe(true);
    }
    for (const field of storylinesDashboardPage.sortableFields) {
      expect(listKeys.has(field)).toBe(true);
    }
  });
});

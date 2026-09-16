/** @vitest-environment node */
import {
  detailBlockSchema,
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  resolvePath,
  type DetailBlock,
} from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { knowledgeIngestionRunsDashboardPage } from "./dashboard-page";
import {
  mapRowToDetailItem,
  type KnowledgeIngestionRunDetailRow,
} from "./detail-mapper";

const detailBlocks = knowledgeIngestionRunsDashboardPage.detailBlocks ?? [];

const sampleDetail = () =>
  mapRowToDetailItem({
    id: "run-1",
    scheduleExecutionId: "exec-1",
    startedAt: new Date("2026-09-15T02:00:00.000Z"),
    completedAt: new Date("2026-09-15T02:04:30.000Z"),
    status: "success",
    agentVersion: "0.1.0",
    watermarkAt: new Date("2026-09-15T01:59:00.000Z"),
    considered: 10,
    storylinesOpened: 2,
    developmentsOpened: 2,
    citationsAdded: 3,
    storylinesLocked: 0,
    skippedNoAnchors: 1,
    stopReason: "watermark reached",
    durationMs: 270000,
    createdAt: new Date("2026-09-15T02:00:00.000Z"),
    _count: { developments: 1 },
    developments: [
      {
        id: "d1",
        title: "Delay reported",
        observedAt: new Date("2026-09-15T02:01:00.000Z"),
        storylineId: "s1",
        storyline: { name: "Contract delay", kind: "story", locked: false },
        _count: { citations: 2 },
      },
    ],
  } as unknown as KnowledgeIngestionRunDetailRow);

const findBlock = (label: string): DetailBlock => {
  const block = detailBlocks.find((entry) => entry.label === label);
  if (!block) throw new Error(`block not found: ${label}`);

  return block as DetailBlock;
};

describe("knowledgeIngestionRunsDashboardPage", () => {
  it("registers as a read-only sidebar table at order 46", () => {
    expect(knowledgeIngestionRunsDashboardPage.order).toBe(46);
    expect(knowledgeIngestionRunsDashboardPage.actions).toEqual({
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

  it("flags a run that skipped sources for want of anchors", () => {
    const rule = findBlock("Run").sectionRule;

    expect(rule).toMatchObject({ badge: "muted", label: "sources skipped" });

    const ast = parseDetailBlockRule(rule?.when ?? "");

    expect(evaluateDetailBlockRule(ast, { skippedNoAnchors: 3 })).toBe(true);
    expect(evaluateDetailBlockRule(ast, { skippedNoAnchors: 0 })).toBe(false);
  });

  it("resolves every stat card and key-value field on the detail payload", () => {
    const outcome = findBlock("Run");
    if (outcome.type !== "panel") throw new Error("expected a panel block");
    const detail = sampleDetail();

    for (const child of outcome.blocks) {
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

  it("links each development row back to its storyline page", () => {
    const table = findBlock("Developments written");
    if (table.type !== "subTable") throw new Error("expected a subTable block");
    const storylineColumn = table.columns.find(
      (column) => column.field === "storylineName",
    );

    expect(storylineColumn?.linkTemplate).toBe(
      "/dashboard/{integrationId}/storylines/{storylineId}",
    );

    const detail = sampleDetail();
    const rows = resolvePath(detail, table.field) as unknown[];

    expect(Array.isArray(rows)).toBe(true);
    for (const column of table.columns) {
      expect(resolvePath(rows[0], column.field)).not.toBeUndefined();
    }
  });

  it("declares only columns that exist on a list row", () => {
    const listKeys = new Set(Object.keys(sampleDetail()));

    for (const column of knowledgeIngestionRunsDashboardPage.columns) {
      expect(listKeys.has(column.key)).toBe(true);
    }
  });
});

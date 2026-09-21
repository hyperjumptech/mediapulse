/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatPerArticle, mapRowToDetailItem } from "./detail-mapper";
import type { KnowledgeExtractionRunRow } from "./list-mapper";

const row = (
  overrides: Partial<{
    mentionsWritten: number;
    rejectedSpanNotInText: number;
    stopReason: string | null;
    durationMs: number | null;
    considered: number;
  }> = {},
): KnowledgeExtractionRunRow =>
  ({
    id: "run-1",
    status: "success",
    tickerId: "ticker-1",
    ticker: { symbol: "FORE", name: "Fore Kopi Indonesia" },
    startedAt: new Date("2026-09-21T09:50:00.000Z"),
    completedAt: new Date("2026-09-21T10:06:27.000Z"),
    durationMs:
      overrides.durationMs === undefined ? 987_339 : overrides.durationMs,
    considered: overrides.considered ?? 30,
    skippedNoCandidates: 0,
    entitiesCreated: 76,
    relationsOpened: 60,
    relationsConfirmed: 11,
    mentionsWritten: overrides.mentionsWritten ?? 105,
    kindsCreated: 24,
    rejectedSpanNotInText: overrides.rejectedSpanNotInText ?? 46,
    rejectedNameNotInText: 0,
    stopReason: overrides.stopReason ?? null,
    watermarkAt: null,
    scheduleExecutionId: null,
    agentVersion: "1.0.0",
    createdAt: new Date("2026-09-21T09:50:00.000Z"),
  }) as unknown as KnowledgeExtractionRunRow;

describe("formatPerArticle", () => {
  it("reports the pace that decides whether a batch fits the job timeout", () => {
    // FORE: 16m27s for 30 articles.
    expect(formatPerArticle(987_339, 30)).toBe("32.9 s per article");
  });

  it("reports nothing without a duration or without articles", () => {
    expect(formatPerArticle(null, 30)).toBe("—");
    expect(formatPerArticle(1_000, 0)).toBe("—");
  });
});

describe("mapRowToDetailItem", () => {
  it("flags a heavy refusal share as danger", () => {
    const item = mapRowToDetailItem(row());

    expect(item.header.rejectionLabel).toBe("30.5%");
    expect(item.header.rejectionVariant).toBe("danger");
  });

  it("warns between the two thresholds", () => {
    const item = mapRowToDetailItem(
      row({ mentionsWritten: 100, rejectedSpanNotInText: 15 }),
    );

    expect(item.header.rejectionVariant).toBe("warning");
  });

  it("treats a clean run as success", () => {
    const item = mapRowToDetailItem(
      row({ mentionsWritten: 100, rejectedSpanNotInText: 0 }),
    );

    expect(item.header.rejectionVariant).toBe("success");
  });

  it("says a clean run stopped for nothing, rather than leaving the cell blank", () => {
    expect(mapRowToDetailItem(row()).stopReason).toBe(
      "Nothing stopped this run early.",
    );
  });

  it("keeps a real stop reason", () => {
    const item = mapRowToDetailItem(row({ stopReason: "3 of 30 failed" }));

    expect(item.stopReason).toBe("3 of 30 failed");
  });

  it("lists every counter, including the refusals", () => {
    const labels = mapRowToDetailItem(row()).counters.map(
      (counter) => counter.label,
    );

    expect(labels).toContain("Relation kinds invented");
    expect(labels).toContain("Refused, span not in the article");
    expect(labels).toContain("Refused, party not named");
  });
});

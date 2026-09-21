/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatRejectionRate,
  mapRowToListItem,
  type KnowledgeExtractionRunRow,
} from "./list-mapper";

const row = (
  overrides: Partial<{
    mentionsWritten: number;
    rejectedSpanNotInText: number;
    rejectedNameNotInText: number;
    durationMs: number | null;
    ticker: { symbol: string; name: string } | null;
    tickerId: string | null;
    agentVersion: string | null;
  }> = {},
): KnowledgeExtractionRunRow =>
  ({
    id: "run-1",
    status: "success",
    tickerId: overrides.tickerId ?? "ticker-1",
    ticker:
      overrides.ticker === undefined
        ? { symbol: "FORE", name: "Fore Kopi Indonesia" }
        : overrides.ticker,
    startedAt: new Date("2026-09-21T09:50:00.000Z"),
    completedAt: new Date("2026-09-21T10:06:27.000Z"),
    durationMs:
      overrides.durationMs === undefined ? 987_339 : overrides.durationMs,
    considered: 30,
    skippedNoCandidates: 0,
    entitiesCreated: 76,
    relationsOpened: 60,
    relationsConfirmed: 11,
    mentionsWritten: overrides.mentionsWritten ?? 105,
    kindsCreated: 24,
    rejectedSpanNotInText: overrides.rejectedSpanNotInText ?? 46,
    rejectedNameNotInText: overrides.rejectedNameNotInText ?? 0,
    stopReason: null,
    watermarkAt: null,
    scheduleExecutionId: null,
    agentVersion:
      overrides.agentVersion === undefined ? "1.0.0" : overrides.agentVersion,
    createdAt: new Date("2026-09-21T09:50:00.000Z"),
  }) as unknown as KnowledgeExtractionRunRow;

describe("formatDuration", () => {
  it("prints milliseconds, seconds and minutes by magnitude", () => {
    expect(formatDuration(420)).toBe("420 ms");
    expect(formatDuration(4_200)).toBe("4.2 s");
    expect(formatDuration(987_339)).toBe("16m 27s");
  });

  it("prints an em dash for a run that never finished", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("formatRejectionRate", () => {
  it("measures refusals against everything the model proposed", () => {
    // FORE's first production run: 105 written, 46 refused.
    expect(formatRejectionRate(105, 46, 0)).toBe("30.5%");
  });

  it("counts both refusal reasons", () => {
    expect(formatRejectionRate(50, 25, 25)).toBe("50.0%");
  });

  it("reports nothing when the model proposed nothing", () => {
    expect(formatRejectionRate(0, 0, 0)).toBe("—");
  });

  it("reports zero rather than an em dash when nothing was refused", () => {
    expect(formatRejectionRate(10, 0, 0)).toBe("0.0%");
  });
});

describe("mapRowToListItem", () => {
  it("carries the issuer and the headline counts", () => {
    const item = mapRowToListItem(row());

    expect(item.tickerSymbol).toBe("FORE");
    expect(item.considered).toBe(30);
    expect(item.entitiesCreated).toBe(76);
    expect(item.rejectionRate).toBe("30.5%");
    expect(item.durationLabel).toBe("16m 27s");
  });

  it("names an unscoped sweep rather than leaving it blank", () => {
    const item = mapRowToListItem(row({ ticker: null, tickerId: null }));

    expect(item.tickerSymbol).toBe("—");
    expect(item.tickerName).toBe("Every issuer");
  });

  it("prints an em dash for a run with no recorded agent version", () => {
    expect(mapRowToListItem(row({ agentVersion: null })).agentVersion).toBe(
      "—",
    );
  });
});

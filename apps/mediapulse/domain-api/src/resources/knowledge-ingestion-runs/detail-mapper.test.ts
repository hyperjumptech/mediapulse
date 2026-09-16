/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  mapRowToDetailItem,
  type KnowledgeIngestionRunDetailRow,
} from "./detail-mapper";

const row = {
  id: "run-1",
  scheduleExecutionId: null,
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
  stopReason: null,
  durationMs: 270000,
  createdAt: new Date("2026-09-15T02:00:00.000Z"),
  _count: { developments: 2 },
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
} as unknown as KnowledgeIngestionRunDetailRow;

describe("mapRowToDetailItem", () => {
  it("carries the list counters through", () => {
    const item = mapRowToDetailItem(row);

    expect(item.citationsAdded).toBe(3);
    expect(item.attachRate).toBe("30.0%");
  });

  it("names the storyline each development landed on", () => {
    const development = mapRowToDetailItem(row).developments[0];

    expect(development?.storylineName).toBe("Contract delay");
    expect(development?.storylineId).toBe("s1");
    expect(development?.citationCount).toBe(2);
  });

  it("handles a run that wrote nothing", () => {
    const empty = {
      ...row,
      developments: [],
      _count: { developments: 0 },
    } as unknown as KnowledgeIngestionRunDetailRow;

    expect(mapRowToDetailItem(empty).developments).toEqual([]);
  });
});

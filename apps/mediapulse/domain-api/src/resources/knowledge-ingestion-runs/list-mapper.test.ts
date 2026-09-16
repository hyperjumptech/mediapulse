/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  formatAttachRate,
  formatDuration,
  mapRowToListItem,
  type KnowledgeIngestionRunRow,
} from "./list-mapper";

const row = {
  id: "run-1",
  scheduleExecutionId: "exec-1",
  startedAt: new Date("2026-09-15T02:00:00.000Z"),
  completedAt: new Date("2026-09-15T02:04:30.000Z"),
  status: "success",
  agentVersion: "0.1.0",
  watermarkAt: new Date("2026-09-15T01:59:00.000Z"),
  considered: 200,
  storylinesOpened: 12,
  developmentsOpened: 31,
  citationsAdded: 50,
  storylinesLocked: 1,
  skippedNoAnchors: 7,
  stopReason: null,
  durationMs: 270000,
  createdAt: new Date("2026-09-15T02:00:00.000Z"),
  _count: { developments: 31 },
} as unknown as KnowledgeIngestionRunRow;

describe("formatDuration", () => {
  it("renders an em dash when the run never recorded one", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("renders sub-second runs in milliseconds", () => {
    expect(formatDuration(420)).toBe("420 ms");
  });

  it("renders seconds with one decimal", () => {
    expect(formatDuration(4200)).toBe("4.2 s");
  });

  it("renders minutes and seconds past a minute", () => {
    expect(formatDuration(270000)).toBe("4m 30s");
  });
});

describe("formatAttachRate", () => {
  it("reports the share of considered sources that produced a citation", () => {
    expect(formatAttachRate(200, 50)).toBe("25.0%");
  });

  it("renders an em dash when nothing was considered", () => {
    expect(formatAttachRate(0, 0)).toBe("—");
  });
});

describe("mapRowToListItem", () => {
  it("maps counters and derived labels", () => {
    const item = mapRowToListItem(row);

    expect(item.status).toBe("success");
    expect(item.considered).toBe(200);
    expect(item.citationsAdded).toBe(50);
    expect(item.attachRate).toBe("25.0%");
    expect(item.durationLabel).toBe("4m 30s");
    expect(item.developmentsWritten).toBe(31);
  });

  it("serializes the optional timestamps", () => {
    const item = mapRowToListItem(row);

    expect(item.completedAt).toBe("2026-09-15T02:04:30.000Z");
    expect(item.watermarkAt).toBe("2026-09-15T01:59:00.000Z");
  });

  it("keeps a still-running row readable", () => {
    const running = {
      ...row,
      status: "running",
      completedAt: null,
      watermarkAt: null,
      durationMs: null,
      agentVersion: null,
    } as unknown as KnowledgeIngestionRunRow;
    const item = mapRowToListItem(running);

    expect(item.completedAt).toBeNull();
    expect(item.watermarkAt).toBeNull();
    expect(item.durationLabel).toBe("—");
    expect(item.agentVersion).toBe("—");
  });
});

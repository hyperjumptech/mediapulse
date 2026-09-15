/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  mapRowToDetailItem,
  type StorylineCitationRowInput,
  type StorylineDetailRow,
} from "./detail-mapper";

const evidence = {
  sharedAnchors: 6,
  containment: 0.71,
  storylineContainment: 0.62,
  path: "body",
};

const row = {
  id: "s1",
  name: "Contract delay",
  kind: "story",
  locked: false,
  lockedReason: null,
  lockedAt: null,
  firstObservedAt: new Date("2026-03-02T00:00:00.000Z"),
  lastObservedAt: new Date("2026-04-18T00:00:00.000Z"),
  createdAt: new Date("2026-03-02T00:00:00.000Z"),
  updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  anchors: [{ anchor: "contract" }, { anchor: "delay" }],
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
      _count: { citations: 2 },
    },
    {
      id: "d2",
      title: "Delay confirmed",
      observedAt: new Date("2026-04-18T00:00:00.000Z"),
      attachEvidence: evidence,
      ingestionRunId: "run-2",
      _count: { citations: 1 },
    },
  ],
} as unknown as StorylineDetailRow;

const citationRows = [
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
      publishedAt: new Date("2026-03-02T00:00:00.000Z"),
    },
  },
  {
    id: "c2",
    createdAt: new Date("2026-03-02T00:00:00.000Z"),
    developmentId: "d1",
    dataSourceId: "ds2",
    dataSource: {
      id: "ds2",
      title: null,
      url: "https://example.test/b",
      registrableDomain: null,
      publishedAt: null,
    },
  },
] as unknown as StorylineCitationRowInput[];

describe("mapRowToDetailItem", () => {
  it("exposes the storyline name as the generic detail title", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.title).toBe("Contract delay");
    expect(item.name).toBe("Contract delay");
  });

  it("sums the citation count across developments", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.developmentCount).toBe(2);
    expect(item.citationCount).toBe(3);
    expect(item.anchorCount).toBe(2);
    expect(item.tickerCount).toBe(1);
  });

  it("marks the opening development and describes the attached one", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.developments[0]?.isOpener).toBe(true);
    expect(item.developments[0]?.evidenceLabel).toBe("Opened this storyline");
    expect(item.developments[1]?.isOpener).toBe(false);
    expect(item.developments[1]?.evidenceLabel).toContain("Body path");
    expect(item.developments[1]?.evidenceVariant).toBe("success");
  });

  it("names the development each citation belongs to", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.citations[0]?.developmentTitle).toBe("Delay reported");
  });

  it("falls back to the url and an em dash for a bare data source", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.citations[1]?.title).toBe("https://example.test/b");
    expect(item.citations[1]?.publisher).toBe("—");
  });

  it("labels the ticker link source", () => {
    const item = mapRowToDetailItem(row, citationRows);

    expect(item.tickers[0]?.sourceLabel).toBe("Placement");
    expect(item.tickers[0]?.symbol).toBe("FORE");
  });

  it("builds a graph covering every layer", () => {
    const item = mapRowToDetailItem(row, citationRows);
    const groups = new Set(item.graph.nodes.map((node) => node.group));

    expect(groups).toEqual(
      new Set(["ticker", "storyline", "development", "source"]),
    );
    expect(item.graph.truncated).toBe(false);
  });

  it("serializes a locked storyline's lock fields", () => {
    const locked = {
      ...row,
      locked: true,
      lockedReason: "ticker ceiling",
      lockedAt: new Date("2026-04-18T00:00:00.000Z"),
    } as unknown as StorylineDetailRow;
    const item = mapRowToDetailItem(locked, citationRows);

    expect(item.locked).toBe(true);
    expect(item.lockedLabel).toBe("Locked");
    expect(item.lockedReason).toBe("ticker ceiling");
    expect(item.lockedAt).toBe("2026-04-18T00:00:00.000Z");
    expect(item.header.lockedVariant).toBe("warning");
  });

  it("leaves lockedAt null for an open storyline", () => {
    expect(mapRowToDetailItem(row, citationRows).lockedAt).toBeNull();
  });

  it("handles a storyline with no citations at all", () => {
    const item = mapRowToDetailItem(row, []);

    expect(item.citations).toEqual([]);
    expect(item.graph.nodes.some((node) => node.group === "source")).toBe(
      false,
    );
  });
});

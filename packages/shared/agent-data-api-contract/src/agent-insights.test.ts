/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema, widgetSchema } from "./agent-insights.js";

const FUNNEL_WIDGET = {
  kind: "funnel" as const,
  stages: [
    { label: "Discovered", value: 100 },
    { label: "Collected", value: 60 },
  ],
};

const TIME_SERIES_WIDGET = {
  kind: "timeSeries" as const,
  points: [{ ts: "2026-06-01T00:00:00.000Z", value: 42 }],
  unit: "articles",
};

const CATEGORY_BAR_WIDGET = {
  kind: "categoryBar" as const,
  bars: [{ label: "Finance", value: 12 }],
};

const BREAKDOWN_WIDGET = {
  kind: "breakdown" as const,
  slices: [{ label: "RSS", value: 80, fraction: 0.8 }],
};

const HISTOGRAM_WIDGET = {
  kind: "histogram" as const,
  buckets: [{ label: "0–10", count: 5 }],
};

const TABLE_WIDGET = {
  kind: "table" as const,
  columns: ["Source", "Count"],
  rows: [["example.com", 7]],
};

const STAT_WIDGET = {
  kind: "stat" as const,
  value: 42,
  unit: "articles",
};

describe("widgetSchema", () => {
  it.each([
    ["funnel", FUNNEL_WIDGET],
    ["timeSeries", TIME_SERIES_WIDGET],
    ["categoryBar", CATEGORY_BAR_WIDGET],
    ["breakdown", BREAKDOWN_WIDGET],
    ["histogram", HISTOGRAM_WIDGET],
    ["table", TABLE_WIDGET],
    ["stat", STAT_WIDGET],
  ] as const)("parses a %s widget", (_kind, widget) => {
    const result = widgetSchema.parse(widget);

    expect(result.kind).toBe(widget.kind);
  });

  it("rejects an unknown kind", () => {
    expect(() => widgetSchema.parse({ kind: "unknown", value: 1 })).toThrow();
  });
});

describe("insightsPayloadSchema", () => {
  it("parses a representative payload with one of each widget kind", () => {
    const payload = insightsPayloadSchema.parse({
      agentId: "page-collection",
      window: "7d",
      generatedAt: "2026-06-08T00:00:00.000Z",
      kpis: [
        {
          id: "k1",
          label: "Articles collected",
          value: 100,
          unit: "items",
          delta: 5,
          sparkline: [10, 20, 15],
        },
      ],
      alerts: [
        {
          id: "a1",
          severity: "warning",
          message: "Discovery failure rate above threshold",
          sectionRef: "s1",
        },
      ],
      sections: [
        { id: "s1", category: "what", title: "Funnel", widget: FUNNEL_WIDGET },
        {
          id: "s2",
          category: "when",
          title: "Over time",
          widget: TIME_SERIES_WIDGET,
        },
        {
          id: "s3",
          category: "where",
          title: "By category",
          widget: CATEGORY_BAR_WIDGET,
        },
        {
          id: "s4",
          category: "who",
          title: "Breakdown",
          widget: BREAKDOWN_WIDGET,
        },
        {
          id: "s5",
          category: "why",
          title: "Histogram",
          widget: HISTOGRAM_WIDGET,
        },
        { id: "s6", category: "how", title: "Table", widget: TABLE_WIDGET },
        { id: "s7", category: "other", title: "Stat", widget: STAT_WIDGET },
      ],
    });

    expect(payload.agentId).toBe("page-collection");
    expect(payload.sections).toHaveLength(7);
    expect(payload.kpis[0]?.sparkline).toEqual([10, 20, 15]);
  });

  it("rejects an unknown window value", () => {
    expect(() =>
      insightsPayloadSchema.parse({
        agentId: "x",
        window: "90d",
        generatedAt: "2026-06-08T00:00:00.000Z",
        kpis: [],
        alerts: [],
        sections: [],
      }),
    ).toThrow();
  });
});

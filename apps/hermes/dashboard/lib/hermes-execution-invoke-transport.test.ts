/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  formatManualExecutionMetadataHints,
  getHermesExecutionInvokeTransportBlurb,
} from "./hermes-execution-invoke-transport";

describe("getHermesExecutionInvokeTransportBlurb", () => {
  it("states dashboard HTTP for manual pipeline runs", () => {
    const b = getHermesExecutionInvokeTransportBlurb("manual-pipeline");
    expect(b.headline).toContain("Dashboard HTTP");
    expect(b.detail).toContain("DataQueue");
  });

  it("states worker + DataQueue for schedules and HTTP triggers", () => {
    expect(
      getHermesExecutionInvokeTransportBlurb("schedule").headline,
    ).toContain("worker");
    expect(
      getHermesExecutionInvokeTransportBlurb("http-trigger").headline,
    ).toContain("worker");
  });
});

describe("formatManualExecutionMetadataHints", () => {
  it("includes dashboard source and request id when present", () => {
    const lines = formatManualExecutionMetadataHints({
      source: "dashboard",
      hermesEnqueueCorrelation: { requestId: "req-abc" },
    });
    expect(lines.some((l) => l.includes("Dashboard"))).toBe(true);
    expect(lines.some((l) => l.includes("req-abc"))).toBe(true);
  });
});

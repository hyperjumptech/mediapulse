/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatManualExecutionMetadataHints } from "./manual-execution-metadata-hints";

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

/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { computeSafeWatermark } from "./watermark.js";

describe("computeSafeWatermark", () => {
  it("advances over a contiguous prefix of terminal results", () => {
    // Setup
    const results = [
      {
        status: "classified_archived",
        receivedDateTime: "2024-01-01T00:00:00Z",
      },
      {
        status: "skipped_not_feedback",
        receivedDateTime: "2024-01-01T01:00:00Z",
      },
    ];

    // Act
    const watermark = computeSafeWatermark(results, undefined);

    // Assert
    expect(watermark).toBe("2024-01-01T01:00:00.000Z");
  });

  it("stops at the first non-terminal result", () => {
    // Setup
    const results = [
      {
        status: "classified_archived",
        receivedDateTime: "2024-01-01T00:00:00Z",
      },
      { status: "failed_retry", receivedDateTime: "2024-01-01T01:00:00Z" },
      {
        status: "classified_archived",
        receivedDateTime: "2024-01-01T02:00:00Z",
      },
    ];

    // Act
    const watermark = computeSafeWatermark(results, undefined);

    // Assert
    expect(watermark).toBe("2024-01-01T00:00:00.000Z");
  });

  it("keeps the previous watermark when the oldest result is not terminal", () => {
    // Setup
    const results = [
      { status: "failed_retry", receivedDateTime: "2024-01-01T00:00:00Z" },
    ];

    // Act
    const watermark = computeSafeWatermark(results, "2023-12-31T00:00:00.000Z");

    // Assert
    expect(watermark).toBe("2023-12-31T00:00:00.000Z");
  });
});

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { scoreFreshness } from "./freshness";

describe("scoreFreshness", () => {
  it("returns expected decay buckets", () => {
    // Setup
    const now = new Date("2026-03-19T10:00:00.000Z");

    // Act
    const today = scoreFreshness({ createdAt: now, now });
    const oneDay = scoreFreshness({
      createdAt: new Date("2026-03-18T09:59:59.000Z"),
      now,
    });
    const twoDays = scoreFreshness({
      createdAt: new Date("2026-03-17T09:00:00.000Z"),
      now,
    });
    const threeDays = scoreFreshness({
      createdAt: new Date("2026-03-16T09:00:00.000Z"),
      now,
    });
    const older = scoreFreshness({
      createdAt: new Date("2026-03-14T09:00:00.000Z"),
      now,
    });

    // Assert
    expect(today).toBe(1);
    expect(oneDay).toBe(0.8);
    expect(twoDays).toBe(0.6);
    expect(threeDays).toBe(0.4);
    expect(older).toBe(0.2);
  });
});

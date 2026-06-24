/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { checkFreshness } from "./check-freshness";

const daysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe("checkFreshness", () => {
  it("keeps a recent page within the 7-day window", () => {
    const result = checkFreshness({
      fetchMetadata: { publishedTime: daysAgoIso(2) },
      content: "",
    });

    expect(result.decision.fresh).toBe(true);
    expect(result.publishedAt).not.toBeNull();
  });

  it("drops a page older than the window as too_old", () => {
    const result = checkFreshness({
      fetchMetadata: { publishedTime: daysAgoIso(30) },
      content: "",
    });

    expect(result.decision).toEqual({ fresh: false, reason: "too_old" });
  });

  it("keeps a page with no detectable date", () => {
    const result = checkFreshness({ content: "No date anywhere here." });

    expect(result.decision.fresh).toBe(true);
    expect(result.publishedAt).toBeNull();
  });
});

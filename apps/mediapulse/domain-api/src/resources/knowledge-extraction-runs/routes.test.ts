/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildRunsListWhere } from "./routes";

describe("buildRunsListWhere", () => {
  it("returns nothing when no filter was asked for", () => {
    expect(buildRunsListWhere({})).toBeUndefined();
  });

  it("filters on a single condition without wrapping it", () => {
    expect(buildRunsListWhere({ status: "failed" })).toStrictEqual({
      status: "failed",
    });
  });

  it("ignores an empty status, which is how the dropdown says all", () => {
    expect(buildRunsListWhere({ status: "  " })).toBeUndefined();
  });

  it("combines issuer, status and a started-at window", () => {
    const from = new Date("2026-09-21T00:00:00.000Z");
    const to = new Date("2026-09-22T00:00:00.000Z");

    const where = buildRunsListWhere({
      status: "success",
      tickerId: "ticker-1",
      from,
      to,
    });

    expect(where).toStrictEqual({
      AND: [
        { status: "success" },
        { tickerId: "ticker-1" },
        { startedAt: { gte: from, lte: to } },
      ],
    });
  });

  it("accepts an open-ended window", () => {
    const from = new Date("2026-09-21T00:00:00.000Z");

    expect(buildRunsListWhere({ from, to: null })).toStrictEqual({
      startedAt: { gte: from },
    });
  });

  it("drops an unparseable date rather than filtering on NaN", () => {
    expect(
      buildRunsListWhere({ from: new Date("nonsense"), to: null }),
    ).toBeUndefined();
  });
});

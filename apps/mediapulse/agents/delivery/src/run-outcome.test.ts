import { describe, expect, it } from "vitest";

import { aggregateRunOutcome } from "./run-outcome.js";

describe("aggregateRunOutcome", () => {
  it.each([
    [[], "skipped"],
    [[{ status: "success" }], "success"],
    [[{ status: "success" }, { status: "skipped" }], "success"],
    [[{ status: "failed" }], "failed"],
    [[{ status: "success" }, { status: "failed" }], "partial_success"],
    [
      [{ status: "skipped" }, { status: "skipped" }],
      "skipped_all_already_delivered",
    ],
  ] as const)("maps %j to %s", (results, expected) => {
    expect(aggregateRunOutcome([...results])).toBe(expected);
  });
});

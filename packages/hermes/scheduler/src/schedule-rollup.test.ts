/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  computeExecutionRunStatusFromStepRollups,
  computeStepRollupFromCounts,
} from "./schedule-rollup";

describe("computeStepRollupFromCounts", () => {
  it("strict: any failure fails the step", () => {
    expect(computeStepRollupFromCounts(2, 1, "strict")).toBe("failed");
    expect(computeStepRollupFromCounts(3, 0, "strict")).toBe("success");
  });

  it("tolerant: mixed outcomes yield partial", () => {
    expect(computeStepRollupFromCounts(1, 1, "tolerant")).toBe("partial");
    expect(computeStepRollupFromCounts(2, 0, "tolerant")).toBe("success");
    expect(computeStepRollupFromCounts(0, 2, "tolerant")).toBe("failed");
  });
});

describe("computeExecutionRunStatusFromStepRollups", () => {
  it("strict: any failed step fails execution", () => {
    expect(
      computeExecutionRunStatusFromStepRollups(["success", "failed"], "strict"),
    ).toBe("failed");
  });

  it("tolerant: partial without failed yields partial run", () => {
    expect(
      computeExecutionRunStatusFromStepRollups(
        ["success", "partial"],
        "tolerant",
      ),
    ).toBe("partial");
  });
});

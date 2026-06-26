import { describe, expect, it } from "vitest";

import {
  narrativeClassifying,
  narrativeRunComplete,
  narrativeRunStart,
} from "./build-activity-narrative.js";

describe("build-activity-narrative", () => {
  it("describes the run start with article count", () => {
    expect(narrativeRunStart(3)).toEqual([
      "Analyzing articles",
      "Loading 3 unanalyzed articles to classify.",
    ]);
  });

  it("singularizes the article count", () => {
    expect(narrativeRunStart(1)[1]).toContain("1 unanalyzed article ");
  });

  it("describes the classifying phase", () => {
    expect(narrativeClassifying(5)).toEqual([
      "Classifying articles",
      "Scoring 5 articles against the acceptance criteria.",
    ]);
  });

  it("summarizes a successful run", () => {
    expect(
      narrativeRunComplete({
        status: "success",
        scored: 5,
        assigned: 4,
        rejected: 1,
      }),
    ).toEqual([
      "Analysis complete",
      "Scored 5 articles; assigned 4 articles across sections; 1 article rejected.",
    ]);
  });

  it("reports a failed run", () => {
    expect(
      narrativeRunComplete({
        status: "failed",
        scored: 0,
        assigned: 0,
        rejected: 0,
      }),
    ).toEqual(["Analysis failed", "No articles could be classified this run."]);
  });
});

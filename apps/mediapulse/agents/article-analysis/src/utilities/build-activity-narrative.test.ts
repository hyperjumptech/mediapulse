import { describe, expect, it } from "vitest";

import {
  narrativeClassifying,
  narrativeRunComplete,
  narrativeRunStart,
} from "./build-activity-narrative.js";

describe("build-activity-narrative", () => {
  it("describes the run start with the backlog count", () => {
    expect(narrativeRunStart(3)).toEqual([
      "Analyzing articles",
      "Found 3 articles awaiting classification and starting to score them.",
    ]);
  });

  it("singularizes the backlog count", () => {
    expect(narrativeRunStart(1)[1]).toContain(
      "1 article awaiting classification",
    );
  });

  it("describes an empty backlog at start", () => {
    expect(narrativeRunStart(0)[1]).toBe(
      "Checking for articles awaiting classification.",
    );
  });

  it("describes the classifying phase with progress", () => {
    expect(narrativeClassifying(5, 10, 40)).toEqual([
      "Classifying articles",
      "Scoring 5 articles against the acceptance criteria (10 of 40 so far).",
    ]);
  });

  it("omits the progress suffix when the backlog is unknown", () => {
    expect(narrativeClassifying(5, 0, 0)[1]).toBe(
      "Scoring 5 articles against the acceptance criteria.",
    );
  });

  it("summarizes a fully drained run", () => {
    expect(
      narrativeRunComplete({
        status: "success",
        scored: 5,
        assigned: 4,
        rejected: 1,
        failureCount: 0,
        skippedByCap: 0,
        stopReason: "drained",
      }),
    ).toEqual([
      "Analysis complete",
      "Classified 5 articles: assigned 4 articles across sections, 1 rejected. The backlog was fully drained.",
    ]);
  });

  it("reports the per-run cap and classification errors on a partial run", () => {
    expect(
      narrativeRunComplete({
        status: "partial_success",
        scored: 100,
        assigned: 80,
        rejected: 20,
        failureCount: 3,
        skippedByCap: 0,
        stopReason: "max_pairs_reached",
      }),
    ).toEqual([
      "Analysis complete",
      "Classified 100 articles: assigned 80 articles across sections, 20 rejected. The per-run limit was reached; the rest is left for the next run. 3 classification errors recorded.",
    ]);
  });

  it("appends the per-ticker cap clause when sources were skipped", () => {
    expect(
      narrativeRunComplete({
        status: "success",
        scored: 5,
        assigned: 4,
        rejected: 1,
        failureCount: 0,
        skippedByCap: 7,
        stopReason: "drained",
      })[1],
    ).toBe(
      "Classified 5 articles: assigned 4 articles across sections, 1 rejected. The backlog was fully drained. 7 sources skipped past the per-ticker cap.",
    );
  });

  it("summarizes a run with nothing to do", () => {
    expect(
      narrativeRunComplete({
        status: "success",
        scored: 0,
        assigned: 0,
        rejected: 0,
        failureCount: 0,
        skippedByCap: 0,
        stopReason: "nothing_to_do",
      }),
    ).toEqual(["Analysis complete", "No articles needed classification."]);
  });

  it("reports a failed run", () => {
    expect(
      narrativeRunComplete({
        status: "failed",
        scored: 0,
        assigned: 0,
        rejected: 0,
        failureCount: 4,
        skippedByCap: 0,
        stopReason: "no_progress",
      }),
    ).toEqual(["Analysis failed", "No articles could be classified this run."]);
  });
});

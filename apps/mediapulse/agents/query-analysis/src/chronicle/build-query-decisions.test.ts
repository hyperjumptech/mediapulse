import { describe, expect, it } from "vitest";

import { buildQueryDecisions } from "./build-query-decisions";
import type { FinalizedQuery } from "../select/finalize";
import type { ProbedCandidate, ProbeSurvivor } from "../probe/yield-probe";

describe("buildQueryDecisions", () => {
  it("marks finalized survivors included and other survivors/dropped rejected with reasons", () => {
    // Setup
    const survivors: ProbeSurvivor[] = [
      {
        text: "Fore Coffee ekspansi gerai",
        intent: "dealsAndMovements",
        language: "id",
        hits: 42,
        rank: 1,
      },
      {
        text: "Fore Coffee kinerja kuartal",
        intent: "dealsAndMovements",
        language: "id",
        hits: 10,
        rank: 2,
      },
    ];
    const dropped: ProbedCandidate[] = [
      {
        text: "Fore Coffee obscure query",
        intent: "industryPulse",
        language: "id",
        hits: 0,
      },
    ];
    const finalized: FinalizedQuery[] = [
      {
        text: "Fore Coffee ekspansi gerai",
        intent: "dealsAndMovements",
        rank: 1,
      },
    ];

    // Act
    const decisions = buildQueryDecisions({ survivors, dropped, finalized });

    // Assert
    expect(decisions).toEqual([
      {
        text: "Fore Coffee ekspansi gerai",
        included: true,
        reason: "included — 42 search hits",
      },
      {
        text: "Fore Coffee kinerja kuartal",
        included: false,
        reason: "rejected — not selected (over quota)",
      },
      {
        text: "Fore Coffee obscure query",
        included: false,
        reason: "rejected — 0 search hits (below minimum)",
      },
    ]);
  });

  it("marks a dropped candidate reinstated into the finalized set as included", () => {
    // Setup
    const dropped: ProbedCandidate[] = [
      {
        text: "Reinstated query",
        intent: "dealsAndMovements",
        language: "en",
        hits: 1,
      },
    ];
    const finalized: FinalizedQuery[] = [
      { text: "Reinstated query", intent: "dealsAndMovements", rank: 1 },
    ];

    // Act
    const decisions = buildQueryDecisions({
      survivors: [],
      dropped,
      finalized,
    });

    // Assert
    expect(decisions).toEqual([
      {
        text: "Reinstated query",
        included: true,
        reason: "included — reinstated for a starved section",
      },
    ]);
  });
});

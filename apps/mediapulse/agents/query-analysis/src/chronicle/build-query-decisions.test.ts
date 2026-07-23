import { describe, expect, it } from "vitest";

import { buildQueryDecisions } from "./build-query-decisions";
import type { FinalizedQuery } from "../select/finalize";
import type { Candidate } from "../pipeline/types";

describe("buildQueryDecisions", () => {
  it("marks finalized candidates included and the rest rejected over quota", () => {
    // Setup
    const candidates: Candidate[] = [
      {
        text: "Fore Coffee ekspansi gerai",
        intent: "dealsAndMovements",
        language: "id",
      },
      {
        text: "Fore Coffee kinerja kuartal",
        intent: "dealsAndMovements",
        language: "id",
      },
      {
        text: "Fore Coffee obscure query",
        intent: "industryPulse",
        language: "id",
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
    const decisions = buildQueryDecisions({ candidates, finalized });

    // Assert
    expect(decisions).toEqual([
      {
        text: "Fore Coffee ekspansi gerai",
        included: true,
        reason: "included — selected for its section",
      },
      {
        text: "Fore Coffee kinerja kuartal",
        included: false,
        reason: "rejected — not selected (over quota)",
      },
      {
        text: "Fore Coffee obscure query",
        included: false,
        reason: "rejected — not selected (over quota)",
      },
    ]);
  });

  it("matches finalized text regardless of whitespace and case", () => {
    // Setup
    const candidates: Candidate[] = [
      {
        text: "Bank Mandiri kredit korporasi",
        intent: "competitiveLandscape",
        language: "id",
      },
    ];
    const finalized: FinalizedQuery[] = [
      {
        text: "  bank   mandiri   kredit korporasi ",
        intent: "competitiveLandscape",
        rank: 1,
      },
    ];

    // Act
    const decisions = buildQueryDecisions({ candidates, finalized });

    // Assert
    expect(decisions[0]?.included).toBe(true);
  });
});

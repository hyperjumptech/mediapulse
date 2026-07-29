import { describe, expect, it } from "vitest";

import { buildSectionScores } from "./build-section-scores";

const breakdown = {
  section: "competitiveLandscape",
  matched: 2,
  total: 5,
  criteriaHash: "abc123",
  sections: [
    { section: "competitiveLandscape", matched: 2, total: 5 },
    { section: "industryPulse", matched: 2, total: 7 },
  ],
  criteria: [
    {
      id: "cl-peer-named",
      section: "competitiveLandscape",
      text: "Include if a peer is named.",
      matched: false,
      note: "No specific competitor of DSSA is mentioned.",
    },
    {
      id: "cl-issuer-relevant",
      section: "competitiveLandscape",
      text: "Include if issuer-relevant.",
      matched: true,
      note: "Coal governance affects DSSA's market.",
    },
    {
      id: "ip-macro-move",
      section: "industryPulse",
      text: "Include if macro.",
      matched: true,
      note: "Reports a national policy shift.",
    },
    {
      id: "ip-multi-issuer",
      section: "industryPulse",
      text: "Include if multi-issuer.",
      matched: false,
      note: "Only one issuer is discussed.",
    },
  ],
};

describe("buildSectionScores", () => {
  it("orders entries by fit score, highest first", () => {
    const scores = buildSectionScores(breakdown, "competitiveLandscape", 0.4);

    expect(scores.map((entry) => entry.section)).toEqual([
      "competitiveLandscape",
      "industryPulse",
    ]);
  });

  it("breaks score ties by canonical display order", () => {
    const tied = {
      ...breakdown,
      sections: [
        { section: "competitiveLandscape", matched: 1, total: 5 },
        { section: "industryPulse", matched: 1, total: 5 },
      ],
    };

    const scores = buildSectionScores(tied, null, null);

    expect(scores.map((entry) => entry.section)).toEqual([
      "industryPulse",
      "competitiveLandscape",
    ]);
  });

  it("scores non-winning sections by their matched fraction", () => {
    const scores = buildSectionScores(breakdown, "competitiveLandscape", 0.4);
    const industryPulse = scores.find(
      (entry) => entry.section === "industryPulse",
    );

    expect(industryPulse?.score).toBeCloseTo(2 / 7);
    expect(industryPulse?.scoreLine).toBe("0.29 - Industry Pulse");
    expect(industryPulse?.scoreVariant).toBe("destructive");
    expect(industryPulse?.isSelected).toBe(false);
  });

  it("marks the winning section and reports its persisted score", () => {
    const scores = buildSectionScores(breakdown, "competitiveLandscape", 0.4);
    const winner = scores.find(
      (entry) => entry.section === "competitiveLandscape",
    );

    expect(winner?.scoreLine).toBe("0.40 - Competitive Landscape");
    expect(winner?.isSelected).toBe(true);
    expect(winner?.scoreVariant).toBe("warning");
  });

  it("prefers the capped persisted score over the winner's matched fraction", () => {
    const capped = {
      ...breakdown,
      sections: [{ section: "competitiveLandscape", matched: 4, total: 5 }],
    };

    const scores = buildSectionScores(capped, "competitiveLandscape", 0.4);

    expect(scores[0]?.score).toBe(0.4);
    expect(scores[0]?.scoreLine).toBe("0.40 - Competitive Landscape");
  });

  it("composes a per-section reason naming matched and missed rules", () => {
    const scores = buildSectionScores(breakdown, "competitiveLandscape", 0.4);
    const industryPulse = scores.find(
      (entry) => entry.section === "industryPulse",
    );

    expect(industryPulse?.reason).toBe(
      [
        "Matched 2 of 7",
        "\u2022 ip-macro-move",
        "",
        "Missed 1",
        "\u2022 ip-multi-issuer: Only one issuer is discussed.",
      ].join("\n"),
    );
  });

  it("collapses a zero-scoring section to a single line instead of listing every miss", () => {
    const zeroed = {
      ...breakdown,
      sections: [{ section: "industryPulse", matched: 0, total: 7 }],
    };

    const scores = buildSectionScores(zeroed, null, null);

    expect(scores[0]?.reason).toBe("No rules matched.");
    expect(scores[0]?.scoreLabel).toBe("0.00");
  });

  it("falls back to the tally alone when a section has no stored rules", () => {
    const legacy = {
      ...breakdown,
      criteria: breakdown.criteria.filter(
        (criterion) => criterion.section === "competitiveLandscape",
      ),
    };

    const scores = buildSectionScores(legacy, "competitiveLandscape", 0.4);
    const industryPulse = scores.find(
      (entry) => entry.section === "industryPulse",
    );

    expect(industryPulse?.reason).toBe("Matched 2 of 7");
  });

  it("scores every section for a rejected row", () => {
    const scores = buildSectionScores(
      { ...breakdown, section: null },
      null,
      null,
    );

    expect(scores).toHaveLength(2);
    expect(scores.every((entry) => !entry.isSelected)).toBe(true);
  });

  it("returns an empty list when the breakdown is missing or unusable", () => {
    expect(buildSectionScores(null, null, null)).toEqual([]);
    expect(buildSectionScores({ sections: "nope" }, null, null)).toEqual([]);
    expect(buildSectionScores({ sections: [] }, null, null)).toEqual([]);
  });

  it("skips malformed section entries rather than throwing", () => {
    const malformed = {
      sections: [
        { section: "industryPulse", matched: 1, total: 7 },
        { section: 42, matched: "x" },
        null,
      ],
      criteria: [],
    };

    const scores = buildSectionScores(malformed, null, null);

    expect(scores).toHaveLength(1);
    expect(scores[0]?.section).toBe("industryPulse");
  });
});

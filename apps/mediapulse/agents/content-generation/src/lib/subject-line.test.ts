import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUBJECT_LINE_WEIGHTS,
  pickBestSubject,
  scoreCuriosityGap,
  scoreLengthFit,
  scoreNoveltyVsHistory,
  scoreReadability,
  scoreSubjectCandidate,
  scoreTickerPresence,
} from "./subject-line.js";

const scoringCtx = {
  tickerSymbol: "BBCA",
  tickerName: "Bank Central Asia",
  weights: DEFAULT_SUBJECT_LINE_WEIGHTS,
};

describe("scoreLengthFit", () => {
  it("returns 0 at 8 and 70 characters and peaks at 42", () => {
    // Assert
    expect(scoreLengthFit("x".repeat(8))).toBe(0);
    expect(scoreLengthFit("x".repeat(70))).toBe(0);
    expect(scoreLengthFit("x".repeat(42))).toBe(1);
    expect(scoreLengthFit("x".repeat(25))).toBeCloseTo(17 / 34, 5);
    expect(scoreLengthFit("x".repeat(56))).toBeCloseTo(14 / 28, 5);
  });
});

describe("scoreTickerPresence", () => {
  it("scores symbol and name matches highest, generic mid, absent low", () => {
    // Assert
    expect(
      scoreTickerPresence(
        "BBCA posts strong quarter",
        "BBCA",
        "Bank Central Asia",
      ),
    ).toBe(1);
    expect(
      scoreTickerPresence(
        "Bank Central Asia profit rises",
        "BBCA",
        "Bank Central Asia",
      ),
    ).toBe(1);
    expect(
      scoreTickerPresence(
        "The bank sees loan growth",
        "BBCA",
        "Bank Central Asia",
      ),
    ).toBe(0.7);
    expect(
      scoreTickerPresence(
        "Industry lending trends shift",
        "BBCA",
        "Bank Central Asia",
      ),
    ).toBe(0.3);
  });
});

describe("scoreCuriosityGap", () => {
  it("rewards curiosity markers and penalizes clickbait", () => {
    // Assert
    expect(scoreCuriosityGap("Why did BBCA loan growth slow?")).toBeCloseTo(
      0.4,
      5,
    );
    expect(
      scoreCuriosityGap("BBCA profit up 12% but margins tighten"),
    ).toBeCloseTo(0.4, 5);
    expect(scoreCuriosityGap("Shocking news from BBCA")).toBe(0);
  });
});

describe("scoreReadability", () => {
  it("penalizes consistently long-syllable words", () => {
    // Assert
    expect(scoreReadability("BCA profit up")).toBeGreaterThan(
      scoreReadability("Conglomerate internationalization accelerates"),
    );
  });
});

describe("scoreNoveltyVsHistory", () => {
  it("returns 1.0 with no history and floors novelty at 0.6", () => {
    // Assert
    expect(scoreNoveltyVsHistory("BBCA profit up 12%", [])).toBe(1);
    expect(
      scoreNoveltyVsHistory("BBCA profit up 12%", ["BBCA profit up 12%"]),
    ).toBeGreaterThanOrEqual(0.6);
    expect(
      scoreNoveltyVsHistory("BBCA profit up 12%", ["BBCA profit up 12%"]),
    ).toBeLessThan(1);
  });
});

describe("scoreSubjectCandidate — weighted composite", () => {
  it("combines axis scores with configured weights", () => {
    // Setup
    const candidate = {
      subject: "Why did BBCA profit rise 12%?",
      style: "question" as const,
      preheader: "Net profit beat estimates on stronger lending.",
    };

    // Act
    const scored = scoreSubjectCandidate(candidate, scoringCtx, []);

    // Assert
    const expected =
      scored.components.lengthFit * DEFAULT_SUBJECT_LINE_WEIGHTS.lengthFit +
      scored.components.tickerPresence *
        DEFAULT_SUBJECT_LINE_WEIGHTS.tickerPresence +
      scored.components.curiosityGap *
        DEFAULT_SUBJECT_LINE_WEIGHTS.curiosityGap +
      scored.components.novelty * DEFAULT_SUBJECT_LINE_WEIGHTS.novelty +
      scored.components.readability * DEFAULT_SUBJECT_LINE_WEIGHTS.readability;
    expect(scored.score).toBeCloseTo(expected, 8);
  });
});

describe("pickBestSubject", () => {
  it("keeps the original when it outscores all candidates", () => {
    // Setup
    const original = "BBCA posts 12% profit growth this quarter";
    const candidates = [
      {
        subject: "News",
        style: "declarative" as const,
        preheader: "Short.",
      },
    ];

    // Act
    const result = pickBestSubject(candidates, original, "Lead prose.", {
      ...scoringCtx,
      recentSubjects: [],
    });

    // Assert
    expect(result.winnerSubject).toBe(original);
    expect(result.winnerScore).toBe(result.originalScore);
    expect(result.rankedTable.length).toBe(2);
  });

  it("selects a stronger candidate when it beats the original", () => {
    // Setup
    const original = "Briefing";
    const strong = "Why did BBCA profit rise 12% while peers lag?";
    const candidates = [
      {
        subject: strong,
        style: "question" as const,
        preheader:
          "Net profit beat estimates on stronger lending across retail.",
      },
    ];

    // Act
    const result = pickBestSubject(candidates, original, "Lead.", {
      ...scoringCtx,
      recentSubjects: [],
    });

    // Assert
    expect(result.winnerSubject).toBe(strong);
    expect(result.winnerScore).toBeGreaterThan(result.originalScore);
    expect(
      result.rankedTable.some((row) => row.candidate.subject === original),
    ).toBe(true);
    expect(
      result.rankedTable.some((row) => row.candidate.subject === strong),
    ).toBe(true);
  });

  it("prefers the original on an exact score tie", () => {
    // Setup
    const tieSubject = "BBCA profit up 12%";
    const candidates = [
      {
        subject: tieSubject,
        style: "numeric" as const,
        preheader: "Matching tie subject for test.",
      },
    ];

    // Act
    const result = pickBestSubject(candidates, tieSubject, "Pulse.", {
      ...scoringCtx,
      recentSubjects: [],
    });

    // Assert
    expect(result.winnerSubject).toBe(tieSubject);
    expect(result.winnerScore).toBe(result.originalScore);
  });
});

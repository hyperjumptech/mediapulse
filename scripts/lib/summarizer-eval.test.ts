import { describe, expect, it } from "vitest";

import {
  checkStructure,
  numericVariants,
  parseJsonObject,
  screenFigures,
  scoreModel,
} from "./summarizer-eval.mjs";

const LIMITS = { maxPoints: 3, maxPointLength: 140 };

describe("numericVariants", () => {
  it("offers the Indonesian spelling of an English figure", () => {
    // Act
    const variants = numericVariants("16,733.33");

    // Assert
    expect(variants).toContain("16.733,33");
  });

  it("offers the English spelling of an Indonesian figure", () => {
    // Act
    const variants = numericVariants("1.19");

    // Assert
    expect(variants).toContain("1,19");
  });

  it("keeps a bare integer matchable with grouped separators", () => {
    // Act
    const variants = numericVariants("50000");

    // Assert
    expect(variants).toContain("50,000");
    expect(variants).toContain("50.000");
  });
});

describe("screenFigures", () => {
  it("passes a figure the source writes in Indonesian format", () => {
    // Setup
    const source =
      "HMA nikel dipatok sebesar US$ 16.733,33/dmt pada periode ini.";
    const points = ["Nickel was set at US$16,733.33 per dmt."];

    // Assert
    expect(screenFigures(points, source)).toEqual([]);
  });

  it("flags a figure absent from the source", () => {
    // Setup
    const source =
      "Capex tahun ini sekitar Rp7 triliun untuk ekspansi jaringan.";
    const points = ["The company allocated Rp9 trillion to network expansion."];

    // Act
    const flags = screenFigures(points, source);

    // Assert
    expect(flags).toHaveLength(1);
    expect(flags[0]?.figure).toBe("9");
  });

  it("ignores small integers that match everywhere", () => {
    // Setup
    const source = "Perusahaan membuka gerai baru di Batam.";
    const points = ["The company opened 3 outlets."];

    // Assert
    expect(screenFigures(points, source)).toEqual([]);
  });
});

describe("checkStructure", () => {
  it("accepts a well formed set of points", () => {
    // Assert
    expect(checkStructure(["A short, complete point."], LIMITS)).toEqual([]);
  });

  it("reports a point past the character budget", () => {
    // Setup
    const long = `${"x".repeat(141)}`;

    // Act
    const violations = checkStructure([long], LIMITS);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("exceeds 140");
  });

  it("reports more points than the cap allows", () => {
    // Act
    const violations = checkStructure(["a", "b", "c", "d"], LIMITS);

    // Assert
    expect(violations[0]).toContain("cap is 3");
  });

  it("reports a point carrying a leading bullet character", () => {
    // Assert
    expect(checkStructure(["• Already bulleted."], LIMITS)).toHaveLength(1);
  });

  it("reports a point carrying non-Latin characters", () => {
    // Assert
    expect(checkStructure(["Revenue rose 華"], LIMITS)).toHaveLength(1);
  });
});

describe("parseJsonObject", () => {
  it("extracts an object wrapped in prose", () => {
    // Act
    const parsed = parseJsonObject('Here you go: {"points": ["one"]} — done');

    // Assert
    expect(parsed).toEqual({ points: ["one"] });
  });

  it("returns null when the response carries no object", () => {
    // Assert
    expect(parseJsonObject("no json here")).toBeNull();
  });
});

describe("scoreModel", () => {
  it("counts restraint only on restatement-only cases", () => {
    // Setup
    const cases = [
      { arm: "description-only", restatementOnly: true },
      { arm: "description-only", restatementOnly: true },
      { arm: "description-only", restatementOnly: false },
      { arm: "body", restatementOnly: false },
    ];
    const outputs = [
      {
        points: [],
        structure: [],
        flags: [],
        error: null,
        usage: { cost: 0.001 },
      },
      {
        points: ["spurious"],
        structure: [],
        flags: [],
        error: null,
        usage: {},
      },
      {
        points: ["legitimate"],
        structure: [],
        flags: [],
        error: null,
        usage: {},
      },
      { points: ["a", "b"], structure: [], flags: [], error: null, usage: {} },
    ];

    // Act
    const score = scoreModel(outputs, cases);

    // Assert
    expect(score.restraintCorrect).toBe(1);
    expect(score.restraintTotal).toBe(2);
    expect(score.spuriousPoints).toBe(1);
    expect(score.legitimateDescriptionPoints).toBe(1);
    expect(score.bodyPoints).toBe(2);
    expect(score.cost).toBeCloseTo(0.001);
  });

  it("counts a transport failure without crediting restraint", () => {
    // Setup
    const cases = [{ arm: "description-only", restatementOnly: true }];
    const outputs = [
      { points: [], structure: [], flags: [], error: "HTTP 500", usage: {} },
    ];

    // Act
    const score = scoreModel(outputs, cases);

    // Assert
    expect(score.failures).toBe(1);
  });
});

/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  narrativeProfile,
  narrativeGenerating,
  narrativeRunComplete,
  narrativeRunStart,
} from "./build-activity-narrative";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}/;

const subject = { symbol: "TLKM", name: "Telkom Indonesia" };

describe("narrativeRunStart", () => {
  it("names the ticker and its company", () => {
    const [title, description] = narrativeRunStart(subject);

    expect(title).toContain("TLKM");
    expect(description).toContain("Telkom Indonesia");
  });
});

describe("narrativeProfile", () => {
  it("says it is reading the curated profile when one exists", () => {
    const [, description] = narrativeProfile(subject, true);

    expect(description).toContain("curated competitors");
  });

  it("says the issuer has no profile when none exists", () => {
    const [, description] = narrativeProfile(subject, false);

    expect(description).toContain("No curated profile");
  });
});

describe("narrativeGenerating", () => {
  it("states the per-intent budget and section count", () => {
    const [, description] = narrativeGenerating(subject, 5, 5);

    expect(description).toContain("5 queries");
    expect(description).toContain("5 newsletter sections");
  });

  it("uses the singular form for a budget of one", () => {
    const [, description] = narrativeGenerating(subject, 1, 5);

    expect(description).toContain("1 query");
    expect(description).not.toContain("1 queries");
  });
});

describe("narrativeRunComplete", () => {
  const fullCoverage = {
    industryPulse: 5,
    competitiveLandscape: 5,
    dealsAndMovements: 5,
    regulatoryPolicyWatch: 5,
    disruptorsOrTech: 5,
  };

  it("reports the saved count with no caveats when every intent is filled", () => {
    const [title, description] = narrativeRunComplete(subject, {
      queryCount: 25,
      queriesPerIntent: 5,
      perIntent: fullCoverage,
      attempts: 1,
    });

    expect(title).toBe("Search plan ready");
    expect(description).toContain("25 search queries");
    expect(description).not.toContain("Short of");
    expect(description).not.toContain("attempt");
  });

  it("names the intents that fell short of the target", () => {
    const [, description] = narrativeRunComplete(subject, {
      queryCount: 18,
      queriesPerIntent: 5,
      perIntent: { ...fullCoverage, industryPulse: 2, dealsAndMovements: 3 },
      attempts: 3,
    });

    expect(description).toContain("Short of the 5-query target");
    expect(description).toContain("industryPulse");
    expect(description).toContain("dealsAndMovements");
    expect(description).toContain("3 attempts");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeRunComplete(subject, {
      queryCount: 25,
      queriesPerIntent: 5,
      perIntent: fullCoverage,
      attempts: 2,
    });

    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

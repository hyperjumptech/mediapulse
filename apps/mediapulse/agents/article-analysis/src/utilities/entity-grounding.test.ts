/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { EntityProposal } from "../analysis-vocabulary.js";
import {
  isAcronymName,
  isLooseMatch,
  stripCorporateSuffixes,
  verifyEntityGrounding,
} from "./entity-grounding.js";

const TYPE_ID = "11111111-1111-4111-a111-111111111111";

const entity = (
  canonicalName: string,
  aliases: string[] = [],
): EntityProposal => ({
  canonicalName,
  typeId: TYPE_ID,
  description: null,
  aliases,
});

describe("stripCorporateSuffixes", () => {
  it("removes Inc suffix from company names", () => {
    expect(stripCorporateSuffixes("Apple Inc.")).toBe("Apple");
  });
});

describe("isAcronymName", () => {
  it("treats short and all-caps names as acronyms", () => {
    expect(isAcronymName("IBM")).toBe(true);
    expect(isAcronymName("CEO")).toBe(true);
    expect(isAcronymName("Apple")).toBe(false);
  });
});

describe("isLooseMatch", () => {
  it("matches suffix-stripped company names against shorter body text", () => {
    expect(isLooseMatch("Apple Inc.", "Shares of Apple rose today.")).not.toBeNull();
  });

  it("does not loose-match acronyms against punctuated variants", () => {
    expect(isLooseMatch("IBM", "I.B.M. reported earnings.")).toBeNull();
  });
});

describe("verifyEntityGrounding", () => {
  it("grounds Apple Inc. when the body contains Apple", () => {
    const result = verifyEntityGrounding({
      entity: entity("Apple Inc."),
      articleText: "Shares of Apple rose after earnings.",
      title: "Market wrap",
    });

    expect(result.grounded).toBe(true);
    expect(result.matchedAlias).toBe("Apple Inc.");
    expect(result.matchedIn).toBe("body");
  });

  it("does not ground IBM when the body only contains I.B.M.", () => {
    const result = verifyEntityGrounding({
      entity: entity("IBM"),
      articleText: "I.B.M. reported earnings.",
      title: "Tech headline today",
    });

    expect(result.grounded).toBe(false);
    expect(result.matchedAlias).toBeNull();
    expect(result.matchedIn).toBeNull();
  });

  it("grounds Tesla when the name appears only in the title", () => {
    const result = verifyEntityGrounding({
      entity: entity("Tesla"),
      articleText: "Electric vehicle demand softened in Europe.",
      title: "Tesla cuts prices in key markets",
    });

    expect(result.grounded).toBe(true);
    expect(result.matchedAlias).toBe("Tesla");
    expect(result.matchedIn).toBe("title");
  });
});

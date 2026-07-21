/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  createTitleDeduper,
  hasSufficientDescription,
  isJunkTitle,
  normalizeTitleKey,
  MIN_DESCRIPTION_CHARS,
} from "./collection-gates";

describe("normalizeTitleKey", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeTitleKey("  BBCA's   Profit,  Up 12%! ")).toBe(
      "bbca s profit up 12",
    );
  });

  it("strips a trailing publisher suffix", () => {
    expect(normalizeTitleKey("Bank profits rise - Reuters")).toBe(
      "bank profits rise",
    );
    expect(normalizeTitleKey("Bank profits rise | Bloomberg")).toBe(
      "bank profits rise",
    );
  });

  it("keeps a long trailing clause that is not a publisher suffix", () => {
    const title =
      "Bank profits rise - and analysts expect the trend to continue next year";

    expect(normalizeTitleKey(title)).toContain("analysts expect");
  });
});

describe("isJunkTitle", () => {
  it("drops bot interstitials and error pages", () => {
    expect(isJunkTitle("Just a moment...")).toBe(true);
    expect(isJunkTitle("Attention Required!")).toBe(true);
    expect(isJunkTitle("Page not found")).toBe(true);
    expect(isJunkTitle("Access Denied")).toBe(true);
    expect(isJunkTitle("404 Not Found")).toBe(true);
    expect(isJunkTitle("503 Service Temporarily Unavailable")).toBe(true);
  });

  it("keeps untitled candidates for the description gates to judge", () => {
    expect(isJunkTitle("")).toBe(false);
    expect(isJunkTitle("   ")).toBe(false);
  });

  it("keeps real headlines that merely contain a junk phrase", () => {
    expect(isJunkTitle("Court rules access denied to bank records")).toBe(
      false,
    );
    expect(isJunkTitle("Regulator finds error in quarterly filings")).toBe(
      false,
    );
    expect(isJunkTitle("BBCA reports record quarterly profit")).toBe(false);
  });
});

describe("hasSufficientDescription", () => {
  it("rejects undefined, empty, and short descriptions", () => {
    expect(hasSufficientDescription(undefined)).toBe(false);
    expect(hasSufficientDescription("")).toBe(false);
    expect(hasSufficientDescription("Too short.")).toBe(false);
  });

  it("accepts a description at the threshold", () => {
    const description = "x".repeat(MIN_DESCRIPTION_CHARS);

    expect(hasSufficientDescription(description)).toBe(true);
  });

  it("honors a custom minimum", () => {
    expect(hasSufficientDescription("Short one.", 5)).toBe(true);
  });
});

describe("createTitleDeduper", () => {
  it("reports a repeated title as duplicate on the second sighting", () => {
    const deduper = createTitleDeduper();

    expect(deduper.isDuplicate("BBCA reports record profit")).toBe(false);
    expect(deduper.isDuplicate("BBCA reports record profit")).toBe(true);
  });

  it("treats syndicated copies with different publisher suffixes as duplicates", () => {
    const deduper = createTitleDeduper();

    expect(deduper.isDuplicate("BBCA reports record profit - Reuters")).toBe(
      false,
    );
    expect(deduper.isDuplicate("BBCA reports record profit | Bloomberg")).toBe(
      true,
    );
  });

  it("never treats untitled candidates as duplicates", () => {
    const deduper = createTitleDeduper();

    expect(deduper.isDuplicate("")).toBe(false);
    expect(deduper.isDuplicate("")).toBe(false);
  });

  it("keeps distinct titles distinct", () => {
    const deduper = createTitleDeduper();

    expect(deduper.isDuplicate("BBCA profit rises")).toBe(false);
    expect(deduper.isDuplicate("BBRI profit rises")).toBe(false);
  });
});

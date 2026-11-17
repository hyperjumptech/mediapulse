import { describe, expect, it } from "vitest";

import { spanIsInText } from "./span-is-in-text.js";

const articleText =
  "Fore Coffee memperluas gerai. Kopi Kenangan bersaing ketat di kelas yang sama.";

describe("spanIsInText", () => {
  it("finds a span copied from the text", () => {
    expect(spanIsInText(articleText, "Kopi Kenangan bersaing")).toBe(true);
  });

  it("ignores differences in whitespace and case", () => {
    expect(spanIsInText(articleText, "kopi kenangan\n  BERSAING")).toBe(true);
  });

  it("refuses a paraphrase", () => {
    expect(spanIsInText(articleText, "Kopi Kenangan is a rival")).toBe(false);
  });

  it("refuses an empty span", () => {
    expect(spanIsInText(articleText, "   ")).toBe(false);
  });
});

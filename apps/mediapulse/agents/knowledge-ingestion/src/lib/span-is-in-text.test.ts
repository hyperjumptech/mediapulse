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

  it("ignores a closing period where the text has a comma", () => {
    const text =
      "Pada triwulan III 2026, sektor ini tumbuh 5,88 persen, kata dia.";

    expect(
      spanIsInText(
        text,
        "Pada triwulan III 2026, sektor ini tumbuh 5,88 persen.",
      ),
    ).toBe(true);
  });

  it("ignores closing quote marks the text doesn't have", () => {
    expect(spanIsInText(articleText, "Fore Coffee memperluas gerai.”")).toBe(
      true,
    );
  });

  it("still refuses a reworded span that ends like the text", () => {
    expect(spanIsInText(articleText, "Fore Coffee menambah gerai.")).toBe(
      false,
    );
  });

  it("refuses a span of only punctuation", () => {
    expect(spanIsInText(articleText, "”.")).toBe(false);
  });
});

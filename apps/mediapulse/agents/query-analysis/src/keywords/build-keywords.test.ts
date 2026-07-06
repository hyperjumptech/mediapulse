/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildEntityQueryTexts } from "./build-keywords";

describe("buildEntityQueryTexts", () => {
  it("emits the bare name plus capped name+keyword combinations", () => {
    expect(
      buildEntityQueryTexts(
        { name: "Bank Mandiri", searchKeywords: ["kredit", "digital", "npl"] },
        2,
      ),
    ).toEqual(["Bank Mandiri", "Bank Mandiri kredit", "Bank Mandiri digital"]);
  });

  it("skips blank keywords and returns nothing for a blank name", () => {
    expect(
      buildEntityQueryTexts({ name: "OJK", searchKeywords: ["  "] }, 2),
    ).toEqual(["OJK"]);
    expect(buildEntityQueryTexts({ name: "   " }, 2)).toEqual([]);
  });
});

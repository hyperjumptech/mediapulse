/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { sharesDistinctiveAnchor, stemIndonesian } from "./indonesian-stem";

describe("stemIndonesian", () => {
  it.each([
    ["dilarang", "larang"],
    ["larang", "larang"],
    ["hanguskan", "hangus"],
    ["hangus", "hangus"],
    ["menkomdigi", "komdig"],
    ["komdigi", "komdig"],
  ])("lands %s and its variant on one stem", (token, expected) => {
    expect(stemIndonesian(token)).toBe(expected);
  });

  it.each(["sisa", "kuota", "internet", "bank"])(
    "leaves %s alone when stripping would leave too little",
    (token) => {
      expect(stemIndonesian(token)).toBe(token);
    },
  );

  it("strips at most one prefix and one suffix", () => {
    expect(stemIndonesian("pelanggan")).toBe("langg");
  });
});

describe("sharesDistinctiveAnchor", () => {
  it("rejects an overlap made only of financial vocabulary", () => {
    expect(
      sharesDistinctiveAnchor(
        ["kredit", "tumbuh", "jadi", "triliun"].map(stemIndonesian),
      ),
    ).toBe(false);
  });

  it("accepts an overlap carrying a named party", () => {
    expect(
      sharesDistinctiveAnchor(
        ["kredit", "tumbuh", "komdigi"].map(stemIndonesian),
      ),
    ).toBe(true);
  });

  it("rejects an empty overlap", () => {
    expect(sharesDistinctiveAnchor([])).toBe(false);
  });
});

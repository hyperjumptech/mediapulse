/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  headingFigures,
  titleFiguresMissingFromPoints,
} from "./title-figure-coverage";

describe("headingFigures", () => {
  it("reads a currency amount written flush against its symbol", () => {
    expect([...headingFigures("Some Rp300 Million")]).toStrictEqual(["300"]);
  });

  it("ignores a four-digit year", () => {
    expect([...headingFigures("Alfamart 2026 Franchise Scheme")]).toStrictEqual(
      [],
    );
  });

  it.each([
    ["XLSMART Operates 1,000 5G BTS", ["1000"]],
    ["Profit Rises in H1 2026", []],
    ["BI's Gift for 81st RI Anniversary", []],
  ])("ignores a figure welded to a letter in %s", (title, expected) => {
    expect([...headingFigures(title)]).toStrictEqual(expected);
  });

  it.each([
    "Erajaya Buyback Starting September 4, 2026",
    "Buyback Runs From 4 September 2026",
  ])("ignores a calendar date in %s", (title) => {
    expect([...headingFigures(title)]).toStrictEqual([]);
  });
});

describe("titleFiguresMissingFromPoints", () => {
  it("reports a heading figure no point carries", () => {
    const missing = titleFiguresMissingFromPoints(
      "Vale Prepares to Operate 3 HPAL Nickel Smelters",
      [
        "The move supports nickel downstreaming and the supply chain for electric vehicle batteries.",
      ],
    );

    expect(missing).toStrictEqual(["3"]);
  });

  it("accepts a figure a point spells out", () => {
    const missing = titleFiguresMissingFromPoints(
      "5 Insurance Companies and 7 Hospital Networks Agree on KAPJ Cooperation",
      [
        "Five insurance companies and seven hospital networks signed agreements to provide financing under KAPJ.",
      ],
    );

    expect(missing).toStrictEqual([]);
  });

  it("accepts a point stating the figure at finer precision", () => {
    const missing = titleFiguresMissingFromPoints(
      "EXCL Rises +2% Amid Extraordinary GMS Announcement",
      ["EXCL shares rose 2.58% to 2,780 in early session."],
    );

    expect(missing).toStrictEqual([]);
  });

  it("accepts a heading that rounded its figure up", () => {
    const missing = titleFiguresMissingFromPoints(
      "ANTAM's Financial Burden Soars 757% in First Half of 2026",
      [
        "ANTAM's financial burden rose 756.7% YoY to Rp346.65 billion in H1 2026.",
      ],
    );

    expect(missing).toStrictEqual([]);
  });

  it("accepts a point writing a multiplier as a word", () => {
    const missing = titleFiguresMissingFromPoints(
      "Grab Targets 3-Fold EV Fleet Increase",
      ["Grab plans to triple its electric vehicle fleet in Indonesia."],
    );

    expect(missing).toStrictEqual([]);
  });

  it("passes a heading carrying no figure", () => {
    const missing = titleFiguresMissingFromPoints(
      "Telkom and CrowdStrike Establish Cooperation",
      ["The cooperation focuses on AI-based cybersecurity solutions."],
    );

    expect(missing).toStrictEqual([]);
  });

  it("passes when the item has no points to check", () => {
    expect(
      titleFiguresMissingFromPoints("Coal Price Could Rise to US$140/Ton", []),
    ).toStrictEqual([]);
  });
});

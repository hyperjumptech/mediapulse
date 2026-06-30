import { describe, expect, it } from "vitest";

import {
  narrativeGenerating,
  narrativeRunComplete,
  narrativeRunStart,
  type TickerSubject,
} from "./build-activity-narrative.js";

const subject: TickerSubject = { symbol: "BBCA", name: "Bank Central Asia" };

describe("build-activity-narrative", () => {
  it("describes the run start with the ticker subject", () => {
    expect(narrativeRunStart(subject)).toEqual([
      "Generating newsletter for BBCA",
      "Loading analyzed articles for BBCA (Bank Central Asia).",
    ]);
  });

  it("describes the generating phase with article count", () => {
    expect(narrativeGenerating(subject, 12)).toEqual([
      "Writing the newsletter",
      "Drafting from 12 analyzed articles across sections for BBCA.",
    ]);
  });

  it("singularizes the article count", () => {
    expect(narrativeGenerating(subject, 1)[1]).toContain("1 analyzed article ");
  });

  it("summarizes a successful run without translations", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 14,
        sectionsFilled: 5,
        translationLanguages: [],
      }),
    ).toEqual([
      "Newsletter complete",
      "Wrote 14 items across 5 sections for BBCA.",
    ]);
  });

  it("summarizes a successful run with translations", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 1,
        sectionsFilled: 1,
        translationLanguages: ["id"],
      }),
    ).toEqual([
      "Newsletter complete",
      "Wrote 1 item across 1 section for BBCA; generated 1 translation (id).",
    ]);
  });

  it("pluralizes multiple translations", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 10,
        sectionsFilled: 4,
        translationLanguages: ["id", "ja"],
      })[1],
    ).toContain("generated 2 translations (id, ja)");
  });

  it("summarizes a skipped run", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "skipped",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
      }),
    ).toEqual(["Skipped", "A newsletter for BBCA already exists today."]);
  });

  it("reports a failed run with the supplied reason", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "failed",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
        reason: "Newsletter generation failed: rate_limited",
      }),
    ).toEqual([
      "Newsletter failed",
      "Newsletter generation failed: rate_limited",
    ]);
  });

  it("falls back to a default reason on failure", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "failed",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
      })[1],
    ).toBe("Newsletter generation failed.");
  });
});

import { describe, expect, it } from "vitest";

import {
  narrativeFetching,
  narrativeGenerating,
  narrativeRunComplete,
  narrativeRunStart,
  narrativeSaving,
  narrativeSourcesLoaded,
  narrativeTranslating,
  narrativeTriage,
  type TickerSubject,
} from "./build-activity-narrative.js";

const subject: TickerSubject = { symbol: "BBCA", name: "Bank Central Asia" };

describe("build-activity-narrative", () => {
  it("describes the run start with the ticker subject", () => {
    expect(narrativeRunStart(subject)).toEqual([
      "Generating newsletter for BBCA",
      "Checking whether BBCA (Bank Central Asia) already has a newsletter today.",
    ]);
  });

  it("describes the loaded analyzed articles", () => {
    expect(narrativeSourcesLoaded(subject, 42)).toEqual([
      "Reading the analyzed articles",
      "Loaded 42 analyzed articles for BBCA.",
    ]);
  });

  it("describes an empty analyzed-article backlog", () => {
    expect(narrativeSourcesLoaded(subject, 0)).toEqual([
      "Reading the analyzed articles",
      "No analyzed articles are waiting for BBCA.",
    ]);
  });

  it("describes the fetch triage phase", () => {
    expect(narrativeTriage(subject, 30)).toEqual([
      "Choosing what to read in full",
      "Deciding which of 30 articles for BBCA need their full text.",
    ]);
  });

  it("describes the fetch phase", () => {
    expect(narrativeFetching(subject, 1)).toEqual([
      "Fetching article text",
      "Downloading the full text of 1 article for BBCA.",
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

  it("describes the persist phase", () => {
    expect(narrativeSaving(subject)).toEqual([
      "Saving the newsletter",
      "Storing the finished newsletter for BBCA.",
    ]);
  });

  it("names the translation languages in full", () => {
    expect(narrativeTranslating(["id"])).toEqual([
      "Translating the newsletter",
      "Writing the Indonesian edition for subscribers who read in that language.",
    ]);
  });

  it("joins multiple translation languages", () => {
    expect(narrativeTranslating(["id", "ja"])[1]).toBe(
      "Writing the Indonesian and ja editions for subscribers who read in those languages.",
    );
  });

  it("summarizes a successful run without extra detail", () => {
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
      "Wrote 1 item across 1 section for BBCA; added Indonesian translation.",
    ]);
  });

  it("joins fetch, dedup, and translation detail", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 14,
        sectionsFilled: 5,
        translationLanguages: ["id"],
        articlesRead: 9,
        repeatsDropped: 3,
      })[1],
    ).toBe(
      "Wrote 14 items across 5 sections for BBCA; read 9 articles in full, dropped 3 stories already covered in an earlier issue and added Indonesian translation.",
    );
  });

  it("mentions sections left out for lack of material", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 8,
        sectionsFilled: 3,
        translationLanguages: [],
        sectionsRemoved: 1,
      })[1],
    ).toBe(
      "Wrote 8 items across 3 sections for BBCA. 1 section had too little material and was left out.",
    );
  });

  it("omits zeroed detail clauses", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "success",
        itemsWritten: 8,
        sectionsFilled: 3,
        translationLanguages: [],
        articlesRead: 0,
        repeatsDropped: 0,
        sectionsRemoved: 0,
      })[1],
    ).toBe("Wrote 8 items across 3 sections for BBCA.");
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

  it("separates an empty backlog from a failure", () => {
    expect(
      narrativeRunComplete(subject, {
        status: "no_sources",
        itemsWritten: 0,
        sectionsFilled: 0,
        translationLanguages: [],
      }),
    ).toEqual([
      "Nothing to write",
      "BBCA has no analyzed articles to write from yet.",
    ]);
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

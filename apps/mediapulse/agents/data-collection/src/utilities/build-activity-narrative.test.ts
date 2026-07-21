/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  narrativeFetching,
  narrativeRunComplete,
  narrativeRunStart,
  narrativeSearching,
} from "./build-activity-narrative";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}/;

const subject = { symbol: "BUVA", name: "Bukit Uluwatu Villa" };

describe("narrativeRunStart", () => {
  it("title contains the symbol", () => {
    const [title] = narrativeRunStart(subject);
    expect(title).toContain("BUVA");
  });

  it("description contains the symbol and name", () => {
    const [, description] = narrativeRunStart(subject);
    expect(description).toContain("BUVA");
    expect(description).toContain("Bukit Uluwatu Villa");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeRunStart(subject);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeSearching", () => {
  it("uses singular form when queryCount is 1", () => {
    const [title, description] = narrativeSearching(subject, 1);
    expect(title).toBe("Searching the web");
    expect(description).toContain("1 search query");
    expect(description).not.toContain("queries");
  });

  it("uses plural form when queryCount is 5", () => {
    const [, description] = narrativeSearching(subject, 5);
    expect(description).toContain("5 search queries");
    expect(description).toContain("BUVA");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeSearching(subject, 3);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeFetching", () => {
  it("titles the screening phase without implying a fetch", () => {
    const [title, description] = narrativeFetching(subject);
    expect(title).toBe("Screening results");
    expect(description).toContain("BUVA");
    expect(description.toLowerCase()).not.toContain("download");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeFetching(subject);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeRunComplete", () => {
  it("mentions the symbol and saved count when persisted is 5 with freshness drops", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 5,
      droppedByFreshness: 3,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: null,
      roundsExecuted: 1,
      targetSavedSources: 5,
    });
    expect(description).toContain("BUVA");
    expect(description).toContain("5 new sources");
    expect(description).toContain("3 were stale");
  });

  it("starts with 'No new sources' when persisted is 0", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "partial_success",
      persisted: 0,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: null,
      roundsExecuted: 1,
      targetSavedSources: 5,
    });
    expect(description).toContain("No new sources");
  });

  it("mentions target number when stopReason is daily_target_met", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 5,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: "daily_target_met",
      roundsExecuted: 1,
      targetSavedSources: 10,
    });
    expect(description).toContain("10");
  });

  it("notes the time budget when stopReason is wall_clock_exceeded", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "partial_success",
      persisted: 3,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: "wall_clock_exceeded",
      roundsExecuted: 1,
      targetSavedSources: 15,
    });
    expect(description).toContain("time budget");
  });

  it("notes the missing search queries when stopReason is no_queries", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 0,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: "no_queries",
      roundsExecuted: 0,
      targetSavedSources: 5,
    });
    expect(description).toContain("No active search queries were configured.");
  });

  it("notes the target when stopReason is daily_target_met_before_start", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 0,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: "daily_target_met_before_start",
      roundsExecuted: 0,
      targetSavedSources: 8,
    });
    expect(description).toContain("daily target of 8 was reached");
  });

  it("title is 'Collection failed' when status is failed", () => {
    const [title] = narrativeRunComplete(subject, {
      status: "failed",
      persisted: 0,
      droppedByFreshness: 0,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 0,
      droppedByDuplicate: 0,
      failureCount: 2,
      stopReason: null,
      roundsExecuted: 1,
      targetSavedSources: 5,
    });
    expect(title).toBe("Collection failed");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 3,
      droppedByFreshness: 1,
      droppedByRelevance: 0,
      droppedByNonArticleUrl: 0,
      droppedByThinDescription: 1,
      droppedByDuplicate: 0,
      failureCount: 0,
      stopReason: null,
      roundsExecuted: 2,
      targetSavedSources: 5,
    });
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

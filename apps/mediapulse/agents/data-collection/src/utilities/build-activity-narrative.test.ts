/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  narrativeDailyQuota,
  narrativeFilteredResults,
  narrativeFetchStart,
  narrativeQueriesLoaded,
  narrativeRunComplete,
  narrativeRunStart,
  narrativeSearchRound,
  narrativeSavingSources,
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

describe("narrativeQueriesLoaded", () => {
  it("returns correct title and description when queryCount is 0", () => {
    const [title, description] = narrativeQueriesLoaded(subject, 0);
    expect(title).toBe("No search queries configured");
    expect(description).toContain("BUVA");
  });

  it("uses singular form when queryCount is 1", () => {
    const [, description] = narrativeQueriesLoaded(subject, 1);
    expect(description).toContain("1 search query");
    expect(description).not.toContain("queries");
  });

  it("uses plural form when queryCount is 5", () => {
    const [, description] = narrativeQueriesLoaded(subject, 5);
    expect(description).toContain("5 search queries");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeQueriesLoaded(subject, 3);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeDailyQuota", () => {
  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeDailyQuota(subject, 3, 10);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeSearchRound", () => {
  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeSearchRound(subject, 5, 1, 3);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeFilteredResults", () => {
  it("mentions URL count and no removal when droppedCount is 0", () => {
    const [, description] = narrativeFilteredResults(10, 0);
    expect(description).toContain("10 URLs");
    expect(description).not.toContain("removing");
  });

  it("mentions both readyCount and droppedCount when droppedCount is positive", () => {
    const [, description] = narrativeFilteredResults(7, 5);
    expect(description).toContain("7");
    expect(description).toContain("5");
  });

  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeFilteredResults(10, 3);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeFetchStart", () => {
  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeFetchStart(subject, 5);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeSavingSources", () => {
  it("does not contain a UUID pattern", () => {
    const [title, description] = narrativeSavingSources(subject, 8);
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

describe("narrativeRunComplete", () => {
  it("mentions the symbol and saved count when persisted is 5 with relevance drops", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "success",
      persisted: 5,
      droppedByRelevance: 3,
      droppedByFreshness: 0,
      contentQualityDropped: 0,
      failureCount: 0,
      stopReason: null,
      roundsExecuted: 1,
      targetSavedSources: 5,
    });
    expect(description).toContain("BUVA");
    expect(description).toContain("5 new sources");
    expect(description).toContain("3 did not mention BUVA");
  });

  it("starts with 'No new sources' when persisted is 0", () => {
    const [, description] = narrativeRunComplete(subject, {
      status: "partial_success",
      persisted: 0,
      droppedByRelevance: 0,
      droppedByFreshness: 0,
      contentQualityDropped: 0,
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
      droppedByRelevance: 0,
      droppedByFreshness: 0,
      contentQualityDropped: 0,
      failureCount: 0,
      stopReason: "daily_target_met",
      roundsExecuted: 1,
      targetSavedSources: 10,
    });
    expect(description).toContain("10");
  });

  it("title is 'Collection failed' when status is failed", () => {
    const [title] = narrativeRunComplete(subject, {
      status: "failed",
      persisted: 0,
      droppedByRelevance: 0,
      droppedByFreshness: 0,
      contentQualityDropped: 0,
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
      droppedByRelevance: 1,
      droppedByFreshness: 1,
      contentQualityDropped: 1,
      failureCount: 0,
      stopReason: null,
      roundsExecuted: 2,
      targetSavedSources: 5,
    });
    expect(title).not.toMatch(UUID_PATTERN);
    expect(description).not.toMatch(UUID_PATTERN);
  });
});

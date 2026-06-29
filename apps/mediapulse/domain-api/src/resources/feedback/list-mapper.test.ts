/**
 * Unit tests for newsletter feedback list mapping.
 */

/** @vitest-environment node */
import type { NewsletterFeedbackListRow } from "./list-mapper";
import { describe, expect, it } from "vitest";
import {
  formatCategory,
  formatSentiment,
  mapRowToListItem,
} from "./list-mapper";

describe("formatSentiment", () => {
  it("maps each sentiment to a label", () => {
    expect(formatSentiment("positive")).toBe("Positive");
    expect(formatSentiment("negative")).toBe("Negative");
    expect(formatSentiment("neutral")).toBe("Neutral");
    expect(formatSentiment("mixed")).toBe("Mixed");
  });

  it("returns an em dash when unclassified", () => {
    expect(formatSentiment(null)).toBe("—");
  });
});

describe("formatCategory", () => {
  it("maps each category to a label", () => {
    expect(formatCategory("feature_request")).toBe("Feature request");
    expect(formatCategory("bug")).toBe("Bug");
  });

  it("returns an em dash when unclassified", () => {
    expect(formatCategory(null)).toBe("—");
  });
});

const baseRow: NewsletterFeedbackListRow = {
  id: "fb-1",
  senderEmail: "reader@example.com",
  subject: "Loved it",
  rawBody: "Great newsletter!",
  receivedAt: new Date("2026-06-20T08:00:00.000Z"),
  graphMessageId: "graph-1",
  inReplyTo: "<nl.n1.ut1@example.com>",
  sentiment: "positive",
  category: "praise",
  classifierModel: "claude-haiku-4-5",
  classifiedAt: new Date("2026-06-20T08:05:00.000Z"),
  userId: "user-1",
  userTickerId: "ut-1",
  newsletterId: "n-1",
  createdAt: new Date("2026-06-20T08:06:00.000Z"),
  updatedAt: new Date("2026-06-20T08:06:00.000Z"),
};

describe("mapRowToListItem", () => {
  it("maps scalar fields, classification labels, and ISO dates", () => {
    const item = mapRowToListItem(baseRow);

    expect(item).toEqual({
      id: "fb-1",
      senderEmail: "reader@example.com",
      subject: "Loved it",
      sentiment: "Positive",
      category: "Praise",
      receivedAt: baseRow.receivedAt.toISOString(),
      createdAt: baseRow.createdAt.toISOString(),
    });
  });

  it("falls back to an em dash for null subject and unclassified rows", () => {
    const row: NewsletterFeedbackListRow = {
      ...baseRow,
      subject: null,
      sentiment: null,
      category: null,
    };

    const item = mapRowToListItem(row);

    expect(item.subject).toBe("—");
    expect(item.sentiment).toBe("—");
    expect(item.category).toBe("—");
  });
});

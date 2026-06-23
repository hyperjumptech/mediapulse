/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { agentDataApiManifest } from "./agent-data-api-manifest.js";
import {
  postNewsletterFeedbackRecordBodySchema,
  postNewsletterFeedbackRecordResponseSchema,
} from "./newsletter-feedback.js";

describe("postNewsletterFeedbackRecordBodySchema", () => {
  it("accepts a fully-populated feedback body", () => {
    // Act
    const parsed = postNewsletterFeedbackRecordBodySchema.parse({
      graphMessageId: "graph-1",
      senderEmail: "reader@example.com",
      subject: "Re: Your AAPL newsletter",
      rawBody: "Loved this, keep it coming!",
      receivedAt: "2026-01-01T10:00:00.000Z",
      inReplyToMessageId: "<nl.news-1.ut-1@mediapulse>",
      sentiment: "positive",
      category: "praise",
      classifierModel: "claude-opus-4-8",
    });

    // Assert
    expect(parsed.sentiment).toBe("positive");
    expect(parsed.category).toBe("praise");
  });

  it("rejects an invalid sender email", () => {
    // Act / Assert
    expect(() =>
      postNewsletterFeedbackRecordBodySchema.parse({
        graphMessageId: "graph-1",
        senderEmail: "not-an-email",
        rawBody: "hi",
        receivedAt: "2026-01-01T10:00:00.000Z",
        sentiment: "neutral",
        category: "other",
      }),
    ).toThrow();
  });

  it("rejects an unknown category", () => {
    // Act / Assert
    expect(() =>
      postNewsletterFeedbackRecordBodySchema.parse({
        graphMessageId: "graph-1",
        senderEmail: "reader@example.com",
        rawBody: "hi",
        receivedAt: "2026-01-01T10:00:00.000Z",
        sentiment: "neutral",
        category: "spam",
      }),
    ).toThrow();
  });
});

describe("postNewsletterFeedbackRecordResponseSchema", () => {
  it("accepts a response with partial correlation", () => {
    // Act
    const parsed = postNewsletterFeedbackRecordResponseSchema.parse({
      feedbackId: "11111111-1111-4111-a111-111111111111",
      created: true,
      correlated: { userId: "22222222-2222-4222-a222-222222222222" },
    });

    // Assert
    expect(parsed.created).toBe(true);
    expect(parsed.correlated.userTickerId).toBeUndefined();
  });
});

describe("agentDataApiManifest", () => {
  it("exposes newsletterFeedbackRecord on v1 and v2", () => {
    // Assert
    expect(agentDataApiManifest.newsletterFeedbackRecord.v1.post).toBeDefined();
    expect(agentDataApiManifest.newsletterFeedbackRecord.v2.post).toBeDefined();
  });
});

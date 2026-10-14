import { describe, expect, it } from "vitest";

import {
  buildDay1WelcomeMessageId,
  buildNewsletterMessageId,
} from "./message-id.js";

describe("buildNewsletterMessageId", () => {
  it("embeds the newsletter and userTicker ids using the sender domain", () => {
    const messageId = buildNewsletterMessageId(
      "news-1",
      "ut-1",
      '"MediaPulse" <news@mp.example.com>',
    );

    expect(messageId).toBe("<nl.news-1.ut-1@mp.example.com>");
  });

  it("falls back to a fixed domain when the sender has none", () => {
    const messageId = buildNewsletterMessageId("news-1", "ut-1", "no-domain");

    expect(messageId).toBe("<nl.news-1.ut-1@mediapulse>");
  });
});

describe("buildDay1WelcomeMessageId", () => {
  it("embeds the dispatch and userTicker ids under the welcome prefix", () => {
    const messageId = buildDay1WelcomeMessageId(
      "dispatch-1",
      "ut-1",
      "ceo@mediapulse.example.com",
    );

    expect(messageId).toBe("<d1w.dispatch-1.ut-1@mediapulse.example.com>");
  });
});

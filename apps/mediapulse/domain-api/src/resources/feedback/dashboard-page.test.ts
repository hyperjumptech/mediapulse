import { dashboardViewSchema } from "@hermes/domain-contract";
import type { FeedbackSentiment } from "@mediapulse/database";
import { describe, expect, it } from "vitest";

import {
  feedbackDashboardPage,
  feedbackSentimentBadgeTones,
} from "./dashboard-page";
import { formatSentiment } from "./list-mapper";

describe("feedbackDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(feedbackDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists the sender, the subject and its classification", () => {
    const keys = feedbackDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "senderEmail",
      "subject",
      "sentiment",
      "category",
      "receivedAt",
    ]);
  });

  it("renders the sentiment as the phone badge", () => {
    const sentiment = feedbackDashboardPage.columns.find(
      (column) => column.key === "sentiment",
    );

    expect(sentiment).toMatchObject({ format: "badge", mobile: "badge" });
  });

  it("gives every sentiment label a tone, including unclassified replies", () => {
    const sentiments: Array<FeedbackSentiment | null> = [
      "positive",
      "negative",
      "neutral",
      "mixed",
      null,
    ];
    const labels = sentiments.map((sentiment) => formatSentiment(sentiment));
    const tonedLabels = Object.keys(feedbackSentimentBadgeTones);

    expect(tonedLabels.sort()).toEqual(labels.sort());
  });
});

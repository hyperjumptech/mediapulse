import { describe, it, expect } from "vitest";
import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createNewsletterFeedbackInsightsProvider } from "./newsletter-feedback-insights-provider.js";

const now = new Date();

type Sentiment = "positive" | "negative" | "neutral" | "mixed";
type Category =
  | "praise"
  | "complaint"
  | "feature_request"
  | "bug"
  | "question"
  | "other";

function makeRow(
  offsetMs: number,
  overrides: Partial<{
    senderEmail: string;
    sentiment: Sentiment | null;
    category: Category | null;
    userId: string | null;
  }> = {},
) {
  const at = new Date(now.getTime() - offsetMs);

  return {
    senderEmail: overrides.senderEmail ?? "reader@example.com",
    receivedAt: at,
    createdAt: at,
    // Use `in` checks so an explicit `null` (unclassified / unmatched) is honored
    // rather than coalesced back to the default.
    sentiment:
      "sentiment" in overrides ? (overrides.sentiment ?? null) : "positive",
    category: "category" in overrides ? (overrides.category ?? null) : "praise",
    userId: "userId" in overrides ? (overrides.userId ?? null) : "user-1",
  };
}

function makeProvider(rows: ReturnType<typeof makeRow>[]) {
  return createNewsletterFeedbackInsightsProvider({
    newsletterFeedback: {
      findMany: async () => rows,
    },
  });
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("createNewsletterFeedbackInsightsProvider", () => {
  it("produces a payload that validates against the contract schema", async () => {
    // Setup
    const provider = makeProvider([
      makeRow(2 * HOUR, { sentiment: "positive", category: "praise" }),
      makeRow(3 * HOUR, { sentiment: "negative", category: "bug" }),
    ]);

    // Act
    const payload = await provider.compute({ window: "7d" });

    // Assert
    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.agentId).toBe("newsletter-feedback");
  });

  it("computes negative share, classified, and matched KPIs", async () => {
    // Setup
    const provider = makeProvider([
      makeRow(1 * HOUR, { sentiment: "negative", category: "complaint" }),
      makeRow(2 * HOUR, { sentiment: "mixed", category: "bug" }),
      makeRow(3 * HOUR, { sentiment: "positive", category: "praise" }),
      makeRow(4 * HOUR, {
        sentiment: null,
        category: null,
        userId: null,
      }),
    ]);

    // Act
    const payload = await provider.compute({ window: "7d" });
    const byId = Object.fromEntries(payload.kpis.map((kpi) => [kpi.id, kpi]));

    // Assert
    expect(byId.replies?.value).toBe(4);
    expect(byId.negative_share?.value).toBe(67);
    expect(byId.negative_share?.tone).toBe("critical");
    expect(byId.classified?.value).toBe(75);
    expect(byId.matched_subscriber?.value).toBe(75);
    expect(byId.actionable?.value).toBe(2);
  });

  it("excludes prior-window rows from current counts but uses them for deltas", async () => {
    // Setup
    const provider = makeProvider([
      makeRow(1 * HOUR),
      makeRow(2 * HOUR),
      makeRow(10 * DAY),
    ]);

    // Act
    const payload = await provider.compute({ window: "7d" });
    const replies = payload.kpis.find((kpi) => kpi.id === "replies");

    // Assert
    expect(replies?.value).toBe(2);
    expect(replies?.delta).toBe(1);
  });

  it("flags low classification coverage", async () => {
    // Setup
    const rows = [
      makeRow(1 * HOUR, { sentiment: "positive" }),
      ...Array.from({ length: 5 }, (_unused, index) =>
        makeRow((index + 2) * HOUR, { sentiment: null, category: null }),
      ),
    ];
    const provider = makeProvider(rows);

    // Act
    const payload = await provider.compute({ window: "7d" });

    // Assert
    expect(
      payload.alerts.some(
        (alert) => alert.id === "low-classification-coverage",
      ),
    ).toBe(true);
  });

  it("returns a valid, empty payload when there is no feedback", async () => {
    // Setup
    const provider = makeProvider([]);

    // Act
    const payload = await provider.compute({ window: "30d" });

    // Assert
    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.sections).toEqual([]);
    expect(payload.kpis.find((kpi) => kpi.id === "replies")?.value).toBe(0);
    expect(payload.alerts.some((alert) => alert.id === "no-replies")).toBe(
      true,
    );
  });

  it("masks sender emails in the recent-feedback table", async () => {
    // Setup
    const provider = makeProvider([
      makeRow(1 * HOUR, { senderEmail: "jane.doe@gmail.com" }),
    ]);

    // Act
    const payload = await provider.compute({ window: "7d" });
    const recent = payload.sections.find(
      (section) => section.id === "recent-feedback",
    );
    const serialized = JSON.stringify(recent);

    // Assert
    expect(recent?.widget.kind).toBe("table");
    expect(serialized).not.toContain("jane.doe@gmail.com");
    expect(serialized).toContain("j***@gmail.com");
  });
});

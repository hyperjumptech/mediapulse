import type {
  InsightsPayload,
  KpiCard,
  InsightAlert,
  InsightSection,
} from "@workspace/agent-data-api-contract";

import type {
  AgentInsightsProvider,
  InsightsContext,
} from "../agent-insights-registry.js";

const RECENT_LIMIT = 10;
const LOW_CLASSIFICATION_PCT = 80;

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type FeedbackSentiment = "positive" | "negative" | "neutral" | "mixed";
type FeedbackCategory =
  | "praise"
  | "complaint"
  | "feature_request"
  | "bug"
  | "question"
  | "other";

const SENTIMENTS: FeedbackSentiment[] = [
  "positive",
  "negative",
  "neutral",
  "mixed",
];
const CATEGORIES: FeedbackCategory[] = [
  "praise",
  "complaint",
  "feature_request",
  "bug",
  "question",
  "other",
];
const ACTIONABLE_CATEGORIES = new Set<FeedbackCategory>([
  "bug",
  "complaint",
  "feature_request",
]);

type FeedbackRow = {
  senderEmail: string;
  receivedAt: Date;
  createdAt: Date;
  sentiment: FeedbackSentiment | null;
  category: FeedbackCategory | null;
  userId: string | null;
};

type NewsletterFeedbackInsightsDeps = {
  newsletterFeedback: {
    findMany: (args: {
      where: {
        createdAt: { gte: Date };
        userTicker?: { tickerId: string };
      };
      select: {
        senderEmail: boolean;
        receivedAt: boolean;
        createdAt: boolean;
        sentiment: boolean;
        category: boolean;
        userId: boolean;
      };
    }) => Promise<FeedbackRow[]>;
  };
};

/**
 * Masks an email for display in insights: keeps the first character of the
 * local part and the full domain (`j***@gmail.com`). Never exposes the raw
 * address (PII) in a payload that surfaces in the dashboard.
 *
 * @param email - Raw sender email.
 */
function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) {
    return "***";
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const firstChar = local.slice(0, 1);

  return `${firstChar}***${domain}`;
}

function buildWindowDates(
  windowStart: Date,
  windowEnd: Date,
): Map<string, number> {
  const buckets = new Map<string, number>();
  const current = new Date(windowStart);
  while (current <= windowEnd) {
    const key = current.toISOString().slice(0, 10);
    buckets.set(key, 0);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return buckets;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Builds the agent-insights provider for the newsletter-feedback agent. Surfaces
 * reply volume, sentiment and category mix, classification coverage, and how well
 * replies correlate back to a subscriber.
 *
 * @param deps - Injected `newsletterFeedback` delegate (Prisma) for testability.
 */
export function createNewsletterFeedbackInsightsProvider(
  deps: NewsletterFeedbackInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "newsletter-feedback",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      // The feedback model has no tickerId; scope through the userTicker relation
      // when a tickerId filter is provided.
      const tickerFilter = ctx.tickerId
        ? { userTicker: { tickerId: ctx.tickerId } }
        : {};

      const rows = await deps.newsletterFeedback.findMany({
        where: { createdAt: { gte: priorStart }, ...tickerFilter },
        select: {
          senderEmail: true,
          receivedAt: true,
          createdAt: true,
          sentiment: true,
          category: true,
          userId: true,
        },
      });

      const current = rows.filter((row) => row.createdAt >= windowStart);
      const prior = rows.filter(
        (row) => row.createdAt >= priorStart && row.createdAt < windowStart,
      );

      const total = current.length;
      const classified = current.filter((row) => row.sentiment !== null);
      const negative = classified.filter(
        (row) => row.sentiment === "negative" || row.sentiment === "mixed",
      ).length;
      const matched = current.filter((row) => row.userId !== null).length;
      const actionable = current.filter(
        (row) =>
          row.category !== null && ACTIONABLE_CATEGORIES.has(row.category),
      ).length;

      const negativeShare = pct(negative, classified.length);
      const classifiedPct = pct(classified.length, total);
      const matchedPct = pct(matched, total);

      const priorActionable = prior.filter(
        (row) =>
          row.category !== null && ACTIONABLE_CATEGORIES.has(row.category),
      ).length;
      const priorClassified = prior.filter((row) => row.sentiment !== null);
      const priorNegative = priorClassified.filter(
        (row) => row.sentiment === "negative" || row.sentiment === "mixed",
      ).length;
      const priorNegativeShare = pct(priorNegative, priorClassified.length);

      const negativeTone =
        negativeShare >= 50
          ? "critical"
          : negativeShare >= 30
            ? "warning"
            : "neutral";

      const kpis: KpiCard[] = [
        {
          id: "replies",
          label: "Replies",
          value: total,
          delta: total - prior.length,
        },
        {
          id: "negative_share",
          label: "Negative share",
          value: negativeShare,
          unit: "%",
          tone: negativeTone,
        },
        {
          id: "actionable",
          label: "Actionable",
          value: actionable,
          delta: actionable - priorActionable,
        },
        {
          id: "matched_subscriber",
          label: "Matched to a subscriber",
          value: matchedPct,
          unit: "%",
        },
        {
          id: "classified",
          label: "Classified",
          value: classifiedPct,
          unit: "%",
        },
      ];

      const alerts: InsightAlert[] = [];

      if (
        classified.length >= 5 &&
        priorClassified.length > 0 &&
        negativeShare > priorNegativeShare + 20
      ) {
        alerts.push({
          id: "negative-sentiment-spike",
          severity: "warning",
          message: `Negative feedback share rose from ${priorNegativeShare}% to ${negativeShare}%`,
          sectionRef: "sentiment-breakdown",
        });
      }

      if (
        priorActionable > 0 &&
        actionable > priorActionable * 2 &&
        actionable > 3
      ) {
        alerts.push({
          id: "actionable-surge",
          severity: "warning",
          message: `Bug, complaint, and feature-request replies surged: ${actionable} vs ${priorActionable} in the prior window`,
          sectionRef: "feedback-by-category",
        });
      }

      if (total >= 5 && classifiedPct < LOW_CLASSIFICATION_PCT) {
        alerts.push({
          id: "low-classification-coverage",
          severity: "warning",
          message: `Only ${classifiedPct}% of replies were classified — the classifier step may be failing`,
        });
      }

      if (total === 0 && ctx.window !== "24h") {
        alerts.push({
          id: "no-replies",
          severity: "info",
          message: "No newsletter replies in the window",
        });
      }

      const sections: InsightSection[] = [];

      if (total > 0) {
        const sentimentCounts = new Map<string, number>();
        for (const sentiment of SENTIMENTS) {
          sentimentCounts.set(sentiment, 0);
        }
        let unclassified = 0;
        for (const row of current) {
          if (row.sentiment === null) {
            unclassified += 1;
          } else {
            sentimentCounts.set(
              row.sentiment,
              (sentimentCounts.get(row.sentiment) ?? 0) + 1,
            );
          }
        }
        const sentimentSlices = [
          ...SENTIMENTS.map((sentiment) => ({
            label: sentiment,
            value: sentimentCounts.get(sentiment) ?? 0,
          })),
          { label: "unclassified", value: unclassified },
        ]
          .filter((slice) => slice.value > 0)
          .map((slice) => ({
            label: slice.label,
            value: slice.value,
            fraction: slice.value / total,
          }));

        sections.push({
          id: "sentiment-breakdown",
          category: "what",
          title: "Sentiment breakdown",
          widget: { kind: "breakdown", slices: sentimentSlices },
        });

        const categoryBars = CATEGORIES.map((category) => ({
          label: category,
          value: current.filter((row) => row.category === category).length,
        }))
          .filter((bar) => bar.value > 0)
          .sort((a, b) => b.value - a.value);

        if (categoryBars.length > 0) {
          sections.push({
            id: "feedback-by-category",
            category: "why",
            title: "Feedback by category",
            widget: {
              kind: "categoryBar",
              bars: categoryBars,
              unit: "replies",
            },
          });
        }

        const dailyBuckets = buildWindowDates(windowStart, now);
        for (const row of current) {
          const dayKey = row.createdAt.toISOString().slice(0, 10);
          if (dailyBuckets.has(dayKey)) {
            dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) ?? 0) + 1);
          }
        }
        sections.push({
          id: "replies-over-time",
          category: "when",
          title: "Replies over time",
          widget: {
            kind: "timeSeries",
            points: Array.from(dailyBuckets.entries()).map(([ts, value]) => ({
              ts: `${ts}T00:00:00.000Z`,
              value,
            })),
            unit: "replies",
          },
        });

        const recent = [...current]
          .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
          .slice(0, RECENT_LIMIT);
        sections.push({
          id: "recent-feedback",
          category: "other",
          title: "Recent feedback",
          widget: {
            kind: "table",
            columns: ["Received", "Sentiment", "Category", "From"],
            rows: recent.map((row) => [
              row.receivedAt.toISOString(),
              row.sentiment ?? "unclassified",
              row.category ?? "unclassified",
              maskEmail(row.senderEmail),
            ]),
          },
        });
      }

      return {
        agentId: "newsletter-feedback",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

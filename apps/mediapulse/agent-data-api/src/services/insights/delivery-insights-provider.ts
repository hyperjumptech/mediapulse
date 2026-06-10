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

const TOP_N = 10;
const FAILURE_RATE_THRESHOLD = 0.2;
const RATE_LIMIT_THRESHOLD = 0.1;
const PARTIAL_SUCCESS_SPIKE_THRESHOLD = 0.5;
const STALE_THRESHOLD_24H_MS = 6 * 60 * 60 * 1000;
const STALE_THRESHOLD_DEFAULT_MS = 48 * 60 * 60 * 1000;

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type RecipientRow = {
  status: string;
  attempts: number;
  errorCategory: string | null;
};

type DeliveryRunRow = {
  tickerId: string;
  outcome: string;
  stage: string | null;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  durationMs: number;
  runSkipReason: string | null;
  createdAt: Date;
  recipients: RecipientRow[];
};

type DeliveryInsightsDeps = {
  deliveryRun: {
    findMany: (args: {
      where: {
        agentId: string;
        createdAt: { gte: Date };
        tickerId?: string;
      };
      orderBy: { createdAt: "asc" };
      select: {
        tickerId: boolean;
        outcome: boolean;
        stage: boolean;
        successCount: boolean;
        failureCount: boolean;
        skippedCount: boolean;
        durationMs: boolean;
        runSkipReason: boolean;
        createdAt: boolean;
        recipients: {
          select: {
            status: boolean;
            attempts: boolean;
            errorCategory: boolean;
          };
        };
      };
    }) => Promise<DeliveryRunRow[]>;
  };
};

function bucketTopN<T extends { label: string; value: number }>(
  items: T[],
  n: number,
): T[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= n) {
    return sorted;
  }
  const top = sorted.slice(0, n);
  const restValue = sorted.slice(n).reduce((sum, item) => sum + item.value, 0);
  if (restValue > 0) {
    return [...top, { label: "Other", value: restValue } as T];
  }
  return top;
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

function medianOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }

  return sorted[mid]!;
}

function isSkippedOutcome(outcome: string): boolean {
  return outcome === "skipped" || outcome === "skipped_all_already_delivered";
}

export function createDeliveryInsightsProvider(
  deps: DeliveryInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "delivery",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const runSelect = {
        tickerId: true,
        outcome: true,
        stage: true,
        successCount: true,
        failureCount: true,
        skippedCount: true,
        durationMs: true,
        runSkipReason: true,
        createdAt: true,
        recipients: {
          select: {
            status: true,
            attempts: true,
            errorCategory: true,
          },
        },
      } as const;

      const [runs, priorRuns] = await Promise.all([
        deps.deliveryRun.findMany({
          where: {
            agentId: "delivery",
            createdAt: { gte: windowStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: runSelect,
        }),
        deps.deliveryRun.findMany({
          where: {
            agentId: "delivery",
            createdAt: { gte: priorStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: runSelect,
        }),
      ]);

      const priorWindowRuns = priorRuns.filter(
        (r) => r.createdAt >= priorStart && r.createdAt < windowStart,
      );

      // ─── Run outcome counts ──────────────────────────────────────────────

      const totalRuns = runs.length;
      const activeRuns = runs.filter((r) => !isSkippedOutcome(r.outcome));
      const successRuns = runs.filter((r) => r.outcome === "success");
      const partialSuccessRuns = runs.filter(
        (r) => r.outcome === "partial_success",
      );
      const failedRuns = runs.filter((r) => r.outcome === "failed");
      const skippedRuns = runs.filter((r) => r.outcome === "skipped");
      const skippedAllDeliveredRuns = runs.filter(
        (r) => r.outcome === "skipped_all_already_delivered",
      );

      const priorTotalRuns = priorWindowRuns.length;
      const priorSuccessCount = priorWindowRuns.reduce(
        (sum, r) => sum + r.successCount,
        0,
      );

      // ─── Recipient aggregates ────────────────────────────────────────────

      const totalRecipientsReached = runs.reduce(
        (sum, r) => sum + r.successCount,
        0,
      );

      const activeAttempted = activeRuns.reduce(
        (sum, r) => sum + r.successCount + r.failureCount,
        0,
      );
      const activeDelivered = activeRuns.reduce(
        (sum, r) => sum + r.successCount,
        0,
      );

      const allRecipients = runs.flatMap((r) => r.recipients);
      const failedRecipients = allRecipients.filter(
        (r) => r.status === "failed",
      );

      // ─── KPIs ────────────────────────────────────────────────────────────

      const activeRunCount = successRuns.length + partialSuccessRuns.length;
      const successRate =
        totalRuns > 0 ? Math.round((activeRunCount / totalRuns) * 100) : 0;

      const activeDurations = activeRuns.map((r) => r.durationMs);
      const medianDuration = medianOf(activeDurations);

      const kpis: KpiCard[] = [
        {
          id: "runs",
          label: "Runs",
          value: totalRuns,
          delta: totalRuns - priorTotalRuns,
        },
        {
          id: "success_rate",
          label: "Success rate",
          value: successRate,
          unit: "%",
        },
        {
          id: "recipients_reached",
          label: "Recipients reached",
          value: totalRecipientsReached,
          delta: totalRecipientsReached - priorSuccessCount,
        },
        ...(medianDuration !== null
          ? [
              {
                id: "median_duration_ms",
                label: "Median duration",
                value: medianDuration,
                unit: "ms",
              } satisfies KpiCard,
            ]
          : []),
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      // Recent send/fetch stage failure
      const stageFails = failedRuns.filter(
        (r) => r.stage === "send" || r.stage === "fetch",
      );
      if (stageFails.length > 0) {
        const lastFail = stageFails[stageFails.length - 1]!;
        alerts.push({
          id: `stage-failure-${lastFail.stage}`,
          severity: "warning",
          message: `${stageFails.length} run(s) failed at the "${lastFail.stage}" stage`,
          sectionRef: "why-error-category",
        });
      }

      // Rate-limited recipients
      const rateLimitedRecipients = failedRecipients.filter(
        (r) => r.errorCategory === "resend_rate_limited",
      );
      if (
        allRecipients.length > 0 &&
        rateLimitedRecipients.length / allRecipients.length >
          RATE_LIMIT_THRESHOLD
      ) {
        alerts.push({
          id: "rate-limited-recipients",
          severity: "warning",
          message: `${rateLimitedRecipients.length} recipient(s) were rate-limited by Resend`,
          sectionRef: "why-error-category",
        });
      }

      // Partial success spike
      if (
        activeRuns.length > 0 &&
        partialSuccessRuns.length / activeRuns.length >
          PARTIAL_SUCCESS_SPIKE_THRESHOLD
      ) {
        alerts.push({
          id: "partial-success-spike",
          severity: "warning",
          message: `${Math.round((partialSuccessRuns.length / activeRuns.length) * 100)}% of delivery runs are partial_success — some recipients may be missing newsletters`,
          sectionRef: "what-outcome",
        });
      }

      // High failure rate
      if (
        totalRuns > 0 &&
        failedRuns.length / totalRuns > FAILURE_RATE_THRESHOLD
      ) {
        alerts.push({
          id: "high-failure-rate",
          severity: "warning",
          message: `Failure rate is ${Math.round((failedRuns.length / totalRuns) * 100)}% — above the ${FAILURE_RATE_THRESHOLD * 100}% threshold`,
          sectionRef: "why-error-category",
        });
      }

      // Stale last run
      if (totalRuns > 0) {
        const staleThresholdMs =
          ctx.window === "24h"
            ? STALE_THRESHOLD_24H_MS
            : STALE_THRESHOLD_DEFAULT_MS;
        const lastRun = runs[runs.length - 1];
        if (
          lastRun &&
          now.getTime() - lastRun.createdAt.getTime() > staleThresholdMs
        ) {
          alerts.push({
            id: "stale-last-run",
            severity: "info",
            message: `No run in the last ${ctx.window === "24h" ? "6 hours" : "48 hours"}`,
          });
        }
      }

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      // What — delivery outcome breakdown
      if (totalRuns > 0) {
        const allOutcomeEntries: Array<[string, number]> = [
          ["Success", successRuns.length],
          ["Partial success", partialSuccessRuns.length],
          ["Failed", failedRuns.length],
          ["Skipped", skippedRuns.length],
          ["Skipped (already delivered)", skippedAllDeliveredRuns.length],
        ];
        const outcomeEntries = allOutcomeEntries.filter(
          (entry): entry is [string, number] => entry[1] > 0,
        );

        sections.push({
          id: "what-outcome",
          category: "what",
          title: "Delivery outcome breakdown",
          insight:
            "Distribution of delivery run outcomes over the selected window.",
          widget: {
            kind: "breakdown",
            slices: outcomeEntries.map(([label, value]) => ({
              label,
              value,
              fraction: value / totalRuns,
            })),
          },
        });
      }

      // When — recipients delivered per day (Σ successCount by day)
      const recipientsDailyBuckets = buildWindowDates(windowStart, now);
      for (const run of runs) {
        const dayKey = run.createdAt.toISOString().slice(0, 10);
        if (recipientsDailyBuckets.has(dayKey)) {
          recipientsDailyBuckets.set(
            dayKey,
            (recipientsDailyBuckets.get(dayKey) ?? 0) + run.successCount,
          );
        }
      }
      sections.push({
        id: "when-recipients",
        category: "when",
        title: "Recipients delivered over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(recipientsDailyBuckets.entries()).map(
            ([ts, value]) => ({
              ts: `${ts}T00:00:00.000Z`,
              value,
            }),
          ),
          unit: "recipients",
        },
      });

      // Where — per-ticker delivery counts (categoryBar, top-N)
      const tickerDeliveryCounts = new Map<string, number>();
      for (const run of runs) {
        tickerDeliveryCounts.set(
          run.tickerId,
          (tickerDeliveryCounts.get(run.tickerId) ?? 0) + 1,
        );
      }
      if (tickerDeliveryCounts.size > 0) {
        sections.push({
          id: "where-per-ticker",
          category: "where",
          title: "Deliveries by ticker",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(tickerDeliveryCounts.entries()).map(
                ([label, value]) => ({ label, value }),
              ),
              TOP_N,
            ),
            unit: "runs",
          },
        });
      }

      // Who — recipient funnel (attempted → delivered, from active runs only)
      // Skipped runs are excluded so the funnel reflects actual delivery attempts.
      sections.push({
        id: "who-recipient-funnel",
        category: "who",
        title: "Recipient funnel",
        insight:
          "Skipped runs are excluded — the funnel counts only recipients from runs that attempted delivery.",
        widget: {
          kind: "funnel",
          stages: [
            { label: "Attempted", value: activeAttempted },
            { label: "Delivered", value: activeDelivered },
          ],
        },
      });

      // Why — recipient error category breakdown (only failed recipients)
      if (failedRecipients.length > 0) {
        const errorCategories = new Map<string, number>();
        for (const recipient of failedRecipients) {
          const category = recipient.errorCategory ?? "unknown";
          errorCategories.set(
            category,
            (errorCategories.get(category) ?? 0) + 1,
          );
        }
        const errorTotal = failedRecipients.length;
        sections.push({
          id: "why-error-category",
          category: "why",
          title: "Recipient failure categories",
          widget: {
            kind: "breakdown",
            slices: bucketTopN(
              Array.from(errorCategories.entries()).map(([label, value]) => ({
                label,
                value,
                fraction: errorTotal > 0 ? value / errorTotal : 0,
              })),
              TOP_N,
            ),
          },
        });
      }

      // Why — run skip reason breakdown (skipped runs only)
      const skippedAllRuns = [...skippedRuns, ...skippedAllDeliveredRuns];
      if (skippedAllRuns.length > 0) {
        const skipReasons = new Map<string, number>();
        for (const run of skippedAllRuns) {
          const reason = run.runSkipReason ?? run.outcome;
          skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
        }
        const skipTotal = skippedAllRuns.length;
        sections.push({
          id: "why-skip-reason",
          category: "why",
          title: "Run skip reasons",
          widget: {
            kind: "breakdown",
            slices: Array.from(skipReasons.entries()).map(([label, value]) => ({
              label,
              value,
              fraction: skipTotal > 0 ? value / skipTotal : 0,
            })),
          },
        });
      }

      // How — recipient attempts histogram (from recipient rows, excluding skipped recipients)
      const attemptedRecipients = allRecipients.filter(
        (r) => r.status !== "skipped",
      );
      if (attemptedRecipients.length > 0) {
        const attemptBuckets = new Map([
          ["1 attempt", 0],
          ["2 attempts", 0],
          ["3 attempts", 0],
          ["4+ attempts", 0],
        ]);
        for (const recipient of attemptedRecipients) {
          if (recipient.attempts <= 1) {
            attemptBuckets.set(
              "1 attempt",
              (attemptBuckets.get("1 attempt") ?? 0) + 1,
            );
          } else if (recipient.attempts === 2) {
            attemptBuckets.set(
              "2 attempts",
              (attemptBuckets.get("2 attempts") ?? 0) + 1,
            );
          } else if (recipient.attempts === 3) {
            attemptBuckets.set(
              "3 attempts",
              (attemptBuckets.get("3 attempts") ?? 0) + 1,
            );
          } else {
            attemptBuckets.set(
              "4+ attempts",
              (attemptBuckets.get("4+ attempts") ?? 0) + 1,
            );
          }
        }
        sections.push({
          id: "how-attempts-histogram",
          category: "how",
          title: "Recipient retry attempts",
          widget: {
            kind: "histogram",
            buckets: Array.from(attemptBuckets.entries()).map(
              ([label, count]) => ({ label, count }),
            ),
          },
        });
      }

      // How — median duration stat (active runs only — skipped runs have near-zero duration)
      if (medianDuration !== null) {
        sections.push({
          id: "how-median-duration",
          category: "how",
          title: "Median delivery duration",
          insight: "Duration is measured for active (non-skipped) runs only.",
          widget: {
            kind: "stat",
            value: medianDuration,
            unit: "ms",
          },
        });
      }

      return {
        agentId: "delivery",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

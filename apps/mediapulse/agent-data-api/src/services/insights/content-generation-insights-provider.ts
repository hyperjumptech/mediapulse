import type { Prisma } from "@mediapulse/database";
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
const STALE_THRESHOLD_24H_MS = 6 * 60 * 60 * 1000;
const STALE_THRESHOLD_DEFAULT_MS = 48 * 60 * 60 * 1000;

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type CgRunRow = {
  tickerId: string;
  outcome: string;
  stage: string | null;
  errorCode: string | null;
  errorCategory: string | null;
  durationMs: number | null;
  createdAt: Date;
  details: Prisma.JsonValue | null;
};

type NewsletterRow = {
  tickerId: string;
  ticker: { symbol: string };
  createdAt: Date;
  model: string | null;
  totalTokens: number | null;
};

type ContentGenerationInsightsDeps = {
  contentGenerationRun: {
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
        errorCode: boolean;
        errorCategory: boolean;
        durationMs: boolean;
        createdAt: boolean;
        details: boolean;
      };
    }) => Promise<CgRunRow[]>;
  };
  newsletter: {
    findMany: (args: {
      where: {
        createdAt: { gte: Date };
        tickerId?: string;
      };
      orderBy: { createdAt: "asc" };
      select: {
        tickerId: boolean;
        ticker: { select: { symbol: boolean } };
        createdAt: boolean;
        model: boolean;
        totalTokens: boolean;
      };
    }) => Promise<NewsletterRow[]>;
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

function extractCgFillBySection(
  details: Prisma.JsonValue | null,
): Record<string, { citedBullets: number }> | null {
  if (
    details === null ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return null;
  }
  const sectionFill = (details as Record<string, unknown>).sectionFill;
  if (
    sectionFill === null ||
    typeof sectionFill !== "object" ||
    Array.isArray(sectionFill)
  ) {
    return null;
  }
  const bySection = (sectionFill as Record<string, unknown>).bySection;
  if (
    bySection === null ||
    typeof bySection !== "object" ||
    Array.isArray(bySection)
  ) {
    return null;
  }

  return bySection as Record<string, { citedBullets: number }>;
}

export function createContentGenerationInsightsProvider(
  deps: ContentGenerationInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "content-generation",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const runSelect = {
        tickerId: true,
        outcome: true,
        stage: true,
        errorCode: true,
        errorCategory: true,
        durationMs: true,
        createdAt: true,
        details: true,
      } as const;

      const [runs, priorRuns, newsletters] = await Promise.all([
        deps.contentGenerationRun.findMany({
          where: {
            agentId: "content-generation",
            createdAt: { gte: windowStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: runSelect,
        }),
        deps.contentGenerationRun.findMany({
          where: {
            agentId: "content-generation",
            createdAt: { gte: priorStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: runSelect,
        }),
        deps.newsletter.findMany({
          where: {
            createdAt: { gte: windowStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: {
            tickerId: true,
            ticker: { select: { symbol: true } },
            createdAt: true,
            model: true,
            totalTokens: true,
          },
        }),
      ]);

      const priorWindowRuns = priorRuns.filter(
        (r) => r.createdAt >= priorStart && r.createdAt < windowStart,
      );

      // ─── Outcome counts ──────────────────────────────────────────────────

      const totalRuns = runs.length;
      const successRuns = runs.filter((r) => r.outcome === "success");
      const failedRuns = runs.filter((r) => r.outcome === "failed");
      const skippedRuns = runs.filter((r) => r.outcome === "skipped");

      const priorSuccessCount = priorWindowRuns.filter(
        (r) => r.outcome === "success",
      ).length;

      // Each successful run creates exactly one newsletter, so prior success count
      // approximates prior newsletter count without an additional query.
      const priorNewsletterCount = priorSuccessCount;

      // ─── KPIs ────────────────────────────────────────────────────────────

      const successRate =
        totalRuns > 0 ? Math.round((successRuns.length / totalRuns) * 100) : 0;

      const durations = runs
        .filter((r) => r.durationMs !== null)
        .map((r) => r.durationMs!);
      const medianDuration = medianOf(durations);

      const totalTokens = newsletters.reduce(
        (sum, n) => sum + (n.totalTokens ?? 0),
        0,
      );

      const kpis: KpiCard[] = [
        {
          id: "runs",
          label: "Runs",
          value: totalRuns,
          delta: totalRuns - priorWindowRuns.length,
        },
        {
          id: "success_rate",
          label: "Success rate",
          value: successRate,
          unit: "%",
        },
        {
          id: "newsletters",
          label: "Newsletters generated",
          value: newsletters.length,
          delta: newsletters.length - priorNewsletterCount,
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
        {
          id: "total_tokens",
          label: "Total tokens",
          value: totalTokens,
        },
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      if (
        totalRuns > 0 &&
        failedRuns.length / totalRuns > FAILURE_RATE_THRESHOLD
      ) {
        alerts.push({
          id: "high-failure-rate",
          severity: "warning",
          message: `Failure rate is ${Math.round((failedRuns.length / totalRuns) * 100)}% — above the ${FAILURE_RATE_THRESHOLD * 100}% threshold`,
          sectionRef: "why-failure-by-stage",
        });
      }

      const failuresByStage = new Map<string, number>();
      for (const run of failedRuns) {
        if (run.stage) {
          failuresByStage.set(
            run.stage,
            (failuresByStage.get(run.stage) ?? 0) + 1,
          );
        }
      }
      if (failuresByStage.size > 0) {
        let dominantStage = "";
        let dominantCount = 0;
        for (const [stage, count] of failuresByStage) {
          if (count > dominantCount) {
            dominantStage = stage;
            dominantCount = count;
          }
        }
        if (dominantCount >= 3) {
          alerts.push({
            id: `dominant-failure-stage-${dominantStage}`,
            severity: "warning",
            message: `Most failures occur at the "${dominantStage}" stage (${dominantCount} runs)`,
            sectionRef: "why-failure-by-stage",
          });
        }
      }

      const noSourcesCount = skippedRuns.filter(
        (r) => r.errorCode === "no_sources",
      ).length;
      if (noSourcesCount >= 3) {
        alerts.push({
          id: "recurring-no-sources",
          severity: "warning",
          message: `"no_sources" skip occurred ${noSourcesCount} times — check data pipeline for missing article ingestion`,
          sectionRef: "why-skip-reason",
        });
      }

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

      // What — outcome breakdown
      if (totalRuns > 0) {
        const outcomeSlices = [
          {
            label: "Success",
            value: successRuns.length,
            fraction: successRuns.length / totalRuns,
          },
          {
            label: "Skipped",
            value: skippedRuns.length,
            fraction: skippedRuns.length / totalRuns,
          },
          {
            label: "Failed",
            value: failedRuns.length,
            fraction: failedRuns.length / totalRuns,
          },
        ].filter((s) => s.value > 0);

        sections.push({
          id: "what-outcome",
          category: "what",
          title: "Outcome breakdown",
          insight: "Distribution of run outcomes over the selected window.",
          widget: {
            kind: "breakdown",
            slices: outcomeSlices,
          },
        });
      }

      // What — stage funnel (runs reaching each stage)
      const stageDropCounts = new Map<string, number>();
      for (const run of runs) {
        if (run.stage) {
          stageDropCounts.set(
            run.stage,
            (stageDropCounts.get(run.stage) ?? 0) + 1,
          );
        }
      }
      const reachedPrecheck = totalRuns;
      const reachedLlm =
        reachedPrecheck - (stageDropCounts.get("precheck") ?? 0);
      const reachedValidate = reachedLlm - (stageDropCounts.get("llm") ?? 0);
      const reachedPersist =
        reachedValidate - (stageDropCounts.get("validate") ?? 0);
      const reachedNewsletter =
        reachedPersist - (stageDropCounts.get("persist") ?? 0);

      sections.push({
        id: "what-stage-funnel",
        category: "what",
        title: "Stage funnel",
        insight:
          "Runs passing through each stage of the content-generation pipeline.",
        widget: {
          kind: "funnel",
          stages: [
            { label: "Precheck", value: reachedPrecheck },
            { label: "LLM", value: reachedLlm },
            { label: "Validate", value: reachedValidate },
            { label: "Persist", value: reachedPersist },
            { label: "Newsletter", value: reachedNewsletter },
          ],
        },
      });

      // When — runs per day
      const runsDailyBuckets = buildWindowDates(windowStart, now);
      for (const run of runs) {
        const dayKey = run.createdAt.toISOString().slice(0, 10);
        if (runsDailyBuckets.has(dayKey)) {
          runsDailyBuckets.set(dayKey, (runsDailyBuckets.get(dayKey) ?? 0) + 1);
        }
      }
      sections.push({
        id: "when-runs",
        category: "when",
        title: "Runs over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(runsDailyBuckets.entries()).map(([ts, value]) => ({
            ts: `${ts}T00:00:00.000Z`,
            value,
          })),
          unit: "runs",
        },
      });

      // When — tokens per day (from newsletters only — failed/skipped runs produce no tokens)
      if (newsletters.length > 0) {
        const tokensDailyBuckets = buildWindowDates(windowStart, now);
        for (const newsletter of newsletters) {
          const dayKey = newsletter.createdAt.toISOString().slice(0, 10);
          if (tokensDailyBuckets.has(dayKey)) {
            tokensDailyBuckets.set(
              dayKey,
              (tokensDailyBuckets.get(dayKey) ?? 0) +
                (newsletter.totalTokens ?? 0),
            );
          }
        }
        sections.push({
          id: "when-tokens",
          category: "when",
          title: "Tokens over time",
          insight:
            "Daily token usage reflects successfully generated newsletters only — failed and skipped runs do not consume tokens.",
          widget: {
            kind: "timeSeries",
            points: Array.from(tokensDailyBuckets.entries()).map(
              ([ts, value]) => ({
                ts: `${ts}T00:00:00.000Z`,
                value,
              }),
            ),
            unit: "tokens",
          },
        });
      }

      // Where — newsletters by ticker (top-N)
      const tickerNewsletterCounts = new Map<string, number>();
      for (const newsletter of newsletters) {
        const label = newsletter.ticker?.symbol ?? newsletter.tickerId;
        tickerNewsletterCounts.set(
          label,
          (tickerNewsletterCounts.get(label) ?? 0) + 1,
        );
      }
      if (tickerNewsletterCounts.size > 0) {
        sections.push({
          id: "where-per-ticker",
          category: "where",
          title: "Newsletters by ticker",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(tickerNewsletterCounts.entries()).map(
                ([label, value]) => ({ label, value }),
              ),
              TOP_N,
            ),
            unit: "newsletters",
          },
        });
      }

      // Who — model mix from Newsletter.model
      const modelMix = new Map<string, number>();
      for (const newsletter of newsletters) {
        const model = newsletter.model ?? "unknown";
        modelMix.set(model, (modelMix.get(model) ?? 0) + 1);
      }
      if (modelMix.size > 0) {
        const modelTotal = Array.from(modelMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "who-model-mix",
          category: "who",
          title: "Model mix",
          insight:
            "Model distribution reflects successfully generated newsletters only.",
          widget: {
            kind: "breakdown",
            slices: Array.from(modelMix.entries()).map(([label, value]) => ({
              label,
              value,
              fraction: modelTotal > 0 ? value / modelTotal : 0,
            })),
          },
        });
      }

      // Why — failures by stage (only failed runs)
      if (failedRuns.length > 0) {
        const failureStages = new Map<string, number>();
        for (const run of failedRuns) {
          const stage = run.stage ?? "unknown";
          failureStages.set(stage, (failureStages.get(stage) ?? 0) + 1);
        }
        const failTotal = failedRuns.length;
        sections.push({
          id: "why-failure-by-stage",
          category: "why",
          title: "Failures by stage",
          widget: {
            kind: "breakdown",
            slices: Array.from(failureStages.entries()).map(
              ([label, value]) => ({
                label,
                value,
                fraction: failTotal > 0 ? value / failTotal : 0,
              }),
            ),
          },
        });
      }

      // Why — error category breakdown (only failed runs)
      if (failedRuns.length > 0) {
        const errorCategories = new Map<string, number>();
        for (const run of failedRuns) {
          const category = run.errorCategory ?? "unknown";
          errorCategories.set(
            category,
            (errorCategories.get(category) ?? 0) + 1,
          );
        }
        const categoryTotal = failedRuns.length;
        sections.push({
          id: "why-error-category",
          category: "why",
          title: "Error categories",
          widget: {
            kind: "breakdown",
            slices: Array.from(errorCategories.entries()).map(
              ([label, value]) => ({
                label,
                value,
                fraction: categoryTotal > 0 ? value / categoryTotal : 0,
              }),
            ),
          },
        });
      }

      // Why — skip reason breakdown (only skipped runs)
      if (skippedRuns.length > 0) {
        const skipReasons = new Map<string, number>();
        for (const run of skippedRuns) {
          const reason = run.errorCode ?? "unknown";
          skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);
        }
        const skipTotal = skippedRuns.length;
        sections.push({
          id: "why-skip-reason",
          category: "why",
          title: "Skip reasons",
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

      // How — duration histogram (only non-null durationMs)
      if (durations.length > 0) {
        const durationBuckets = new Map([
          ["< 5s", 0],
          ["5-15s", 0],
          ["15-30s", 0],
          ["30-60s", 0],
          ["> 60s", 0],
        ]);
        for (const ms of durations) {
          const seconds = ms / 1000;
          if (seconds < 5) {
            durationBuckets.set("< 5s", (durationBuckets.get("< 5s") ?? 0) + 1);
          } else if (seconds < 15) {
            durationBuckets.set(
              "5-15s",
              (durationBuckets.get("5-15s") ?? 0) + 1,
            );
          } else if (seconds < 30) {
            durationBuckets.set(
              "15-30s",
              (durationBuckets.get("15-30s") ?? 0) + 1,
            );
          } else if (seconds < 60) {
            durationBuckets.set(
              "30-60s",
              (durationBuckets.get("30-60s") ?? 0) + 1,
            );
          } else {
            durationBuckets.set(
              "> 60s",
              (durationBuckets.get("> 60s") ?? 0) + 1,
            );
          }
        }
        sections.push({
          id: "how-duration-histogram",
          category: "how",
          title: "Run duration distribution",
          widget: {
            kind: "histogram",
            buckets: Array.from(durationBuckets.entries()).map(
              ([label, count]) => ({ label, count }),
            ),
          },
        });
      }

      // How — median duration stat
      if (medianDuration !== null) {
        sections.push({
          id: "how-median-duration",
          category: "how",
          title: "Median run duration",
          widget: {
            kind: "stat",
            value: medianDuration,
            unit: "ms",
          },
        });
      }

      // How — section-fill coverage (cited bullets per section, summed across successful runs)
      const sectionFillTotals = new Map<string, number>();
      for (const run of successRuns) {
        const bySection = extractCgFillBySection(run.details);
        if (bySection === null) {
          continue;
        }
        for (const [sectionId, data] of Object.entries(bySection)) {
          if (typeof data.citedBullets === "number") {
            sectionFillTotals.set(
              sectionId,
              (sectionFillTotals.get(sectionId) ?? 0) + data.citedBullets,
            );
          }
        }
      }
      if (sectionFillTotals.size > 0) {
        sections.push({
          id: "how-section-fill",
          category: "how",
          title: "Section fill coverage",
          insight:
            "Total cited bullets per newsletter section across successful runs.",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(sectionFillTotals.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "cited bullets",
          },
        });
      }

      return {
        agentId: "content-generation",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

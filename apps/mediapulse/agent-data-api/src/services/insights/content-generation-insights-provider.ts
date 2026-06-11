import type { Prisma } from "@mediapulse/database";
import type {
  InsightsPayload,
  KpiCard,
  InsightAlert,
  InsightSection,
} from "@workspace/agent-data-api-contract";
import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";

import type {
  AgentInsightsProvider,
  InsightsContext,
} from "../agent-insights-registry.js";

const TOP_N = 10;
const FAILURE_RATE_THRESHOLD = 0.2;
const STALE_THRESHOLD_24H_MS = 6 * 60 * 60 * 1000;
const STALE_THRESHOLD_DEFAULT_MS = 48 * 60 * 60 * 1000;

// KPI tone thresholds
const SUCCESS_RATE_CRITICAL_THRESHOLD = 60; // below this -> critical
const SUCCESS_RATE_WARNING_THRESHOLD = 80; // below this -> warning (matches FAILURE_RATE_THRESHOLD = 20%)
const MEDIAN_DURATION_WARNING_THRESHOLD_MS = 120_000; // 2 minutes

// Section drop alert threshold: alert when a section is dropped in >20% of successful runs
const SECTION_DROP_RATE_THRESHOLD = 0.2;

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
  promptTokens: number | null;
  completionTokens: number | null;
  configVersion: string | null;
  promptHash: string | null;
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
        promptTokens: boolean;
        completionTokens: boolean;
        configVersion: boolean;
        promptHash: boolean;
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

function extractCgSectionsRemoved(
  details: Prisma.JsonValue | null,
): string[] | null {
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
  const sectionsRemoved = (sectionFill as Record<string, unknown>)
    .sectionsRemoved;
  if (!Array.isArray(sectionsRemoved)) {
    return null;
  }

  return sectionsRemoved.filter(
    (item): item is string => typeof item === "string",
  );
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
            promptTokens: true,
            completionTokens: true,
            configVersion: true,
            promptHash: true,
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

      const newsletterCount = newsletters.length;
      const avgTokensPerNewsletter =
        newsletterCount > 0 ? Math.round(totalTokens / newsletterCount) : null;

      // Determine tones for success_rate and median_duration_ms
      const successRateTone = (() => {
        if (totalRuns === 0) return undefined;
        if (successRate < SUCCESS_RATE_CRITICAL_THRESHOLD)
          return "critical" as const;
        if (successRate < SUCCESS_RATE_WARNING_THRESHOLD)
          return "warning" as const;
        return undefined;
      })();

      const medianDurationTone = (() => {
        if (medianDuration === null) return undefined;
        if (medianDuration > MEDIAN_DURATION_WARNING_THRESHOLD_MS)
          return "warning" as const;
        return undefined;
      })();

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
          ...(successRateTone !== undefined ? { tone: successRateTone } : {}),
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
                ...(medianDurationTone !== undefined
                  ? { tone: medianDurationTone }
                  : {}),
              } satisfies KpiCard,
            ]
          : []),
        {
          id: "total_tokens",
          label: "Total tokens",
          value: totalTokens,
        },
        ...(avgTokensPerNewsletter !== null
          ? [
              {
                id: "avg_tokens_per_newsletter",
                label: "Avg tokens per newsletter",
                value: avgTokensPerNewsletter,
                unit: "tokens",
              } satisfies KpiCard,
            ]
          : []),
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
          message: `Failure rate is ${Math.round((failedRuns.length / totalRuns) * 100)}% -- above the ${FAILURE_RATE_THRESHOLD * 100}% threshold`,
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
          message: `"no_sources" skip occurred ${noSourcesCount} times -- check data pipeline for missing article ingestion`,
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

      // What -- outcome breakdown
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

      // What -- stage funnel (runs reaching each stage)
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

      // When -- runs per day
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

      // When -- tokens per day (from newsletters only -- failed/skipped runs produce no tokens)
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
            "Daily token usage reflects successfully generated newsletters only -- failed and skipped runs do not consume tokens.",
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

      // Where -- newsletters by ticker (top-N)
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

      // Who -- model mix, config version, and prompt hash from Newsletter
      const modelMix = new Map<string, number>();
      const configVersionMix = new Map<string, number>();
      const promptHashMix = new Map<string, number>();
      for (const newsletter of newsletters) {
        const model = newsletter.model ?? "unknown";
        modelMix.set(model, (modelMix.get(model) ?? 0) + 1);

        const configVersion = newsletter.configVersion ?? "unknown";
        configVersionMix.set(
          configVersion,
          (configVersionMix.get(configVersion) ?? 0) + 1,
        );

        const promptHash = newsletter.promptHash ?? "unknown";
        promptHashMix.set(promptHash, (promptHashMix.get(promptHash) ?? 0) + 1);
      }
      if (modelMix.size > 0) {
        const modelTotal = Array.from(modelMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        const configVersionTotal = Array.from(configVersionMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        const promptHashTotal = Array.from(promptHashMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );

        sections.push({
          id: "who-model-mix",
          category: "who",
          title: "Model, config, and prompt distribution",
          insight:
            "Distribution of model, configVersion, and promptHash across successfully generated newsletters.",
          widget: {
            kind: "table",
            columns: ["dimension", "value", "count", "share"],
            rows: [
              ...Array.from(modelMix.entries()).map(
                ([label, value]) =>
                  [
                    "model",
                    label,
                    value,
                    modelTotal > 0
                      ? Math.round((value / modelTotal) * 100) / 100
                      : 0,
                  ] as (string | number | null)[],
              ),
              ...Array.from(configVersionMix.entries()).map(
                ([label, value]) =>
                  [
                    "configVersion",
                    label,
                    value,
                    configVersionTotal > 0
                      ? Math.round((value / configVersionTotal) * 100) / 100
                      : 0,
                  ] as (string | number | null)[],
              ),
              ...Array.from(promptHashMix.entries()).map(
                ([label, value]) =>
                  [
                    "promptHash",
                    label,
                    value,
                    promptHashTotal > 0
                      ? Math.round((value / promptHashTotal) * 100) / 100
                      : 0,
                  ] as (string | number | null)[],
              ),
            ],
          },
        });

        // Config drift alerts
        const distinctConfigVersions = new Set(
          newsletters.map((n) => n.configVersion ?? "unknown"),
        );
        const distinctPromptHashes = new Set(
          newsletters.map((n) => n.promptHash ?? "unknown"),
        );

        if (distinctConfigVersions.size > 1) {
          alerts.push({
            id: "config-version-drift",
            severity: "warning",
            message: `${distinctConfigVersions.size} distinct configVersions active in this window -- newsletters may have been generated with inconsistent configurations`,
            sectionRef: "who-model-mix",
          });
        }

        if (distinctPromptHashes.size > 1) {
          alerts.push({
            id: "prompt-hash-drift",
            severity: "warning",
            message: `${distinctPromptHashes.size} distinct promptHashes active in this window -- prompt definition changed mid-window`,
            sectionRef: "who-model-mix",
          });
        }
      }

      // Why -- failures by stage (only failed runs)
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

      // Why -- error category breakdown (only failed runs)
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

      // Why -- skip reason breakdown (only skipped runs)
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

      // How -- duration histogram (only non-null durationMs)
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

      // How -- section-fill coverage (cited bullets per section, averaged across successful runs)
      // Also track sectionsRemoved per section across successful runs
      const sectionFillTotals = new Map<string, number>();
      const sectionFillRunCounts = new Map<string, number>();
      const sectionRemovedCounts = new Map<string, number>();
      let successRunsWithDetails = 0;

      for (const run of successRuns) {
        const bySection = extractCgFillBySection(run.details);
        const sectionsRemoved = extractCgSectionsRemoved(run.details);

        if (bySection !== null || sectionsRemoved !== null) {
          successRunsWithDetails += 1;
        }

        if (bySection !== null) {
          for (const [sectionId, data] of Object.entries(bySection)) {
            if (typeof data.citedBullets === "number") {
              sectionFillTotals.set(
                sectionId,
                (sectionFillTotals.get(sectionId) ?? 0) + data.citedBullets,
              );
              sectionFillRunCounts.set(
                sectionId,
                (sectionFillRunCounts.get(sectionId) ?? 0) + 1,
              );
            }
          }
        }

        if (sectionsRemoved !== null) {
          for (const sectionId of sectionsRemoved) {
            sectionRemovedCounts.set(
              sectionId,
              (sectionRemovedCounts.get(sectionId) ?? 0) + 1,
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

      // What -- section coverage: avg cited bullets and removal share per section
      const allKnownSections = new Set<string>([
        ...NEWSLETTER_SECTION_IDS,
        ...sectionFillTotals.keys(),
        ...sectionRemovedCounts.keys(),
      ]);

      if (
        successRunsWithDetails > 0 &&
        (sectionFillTotals.size > 0 || sectionRemovedCounts.size > 0)
      ) {
        const coverageRows: (string | number | null)[][] = [];
        for (const sectionId of allKnownSections) {
          const totalBullets = sectionFillTotals.get(sectionId) ?? 0;
          const runCount = sectionFillRunCounts.get(sectionId) ?? 0;
          const avgBullets =
            runCount > 0 ? Math.round((totalBullets / runCount) * 10) / 10 : 0;
          const removedCount = sectionRemovedCounts.get(sectionId) ?? 0;
          const removedShare =
            successRunsWithDetails > 0
              ? Math.round((removedCount / successRunsWithDetails) * 100) / 100
              : 0;
          coverageRows.push([
            sectionId,
            avgBullets,
            removedCount,
            removedShare,
          ]);
        }

        sections.push({
          id: "what-section-coverage",
          category: "what",
          title: "Section coverage",
          insight:
            "Average cited bullets per section and how often each section was removed across successful runs.",
          widget: {
            kind: "table",
            columns: [
              "section",
              "avg_cited_bullets",
              "removed_count",
              "removed_share",
            ],
            rows: coverageRows,
          },
        });

        // Alert when a section is dropped in >20% of successful runs
        for (const [sectionId, removedCount] of sectionRemovedCounts) {
          const dropRate = removedCount / successRunsWithDetails;
          if (dropRate > SECTION_DROP_RATE_THRESHOLD) {
            alerts.push({
              id: `section-drop-${sectionId}`,
              severity: "warning",
              message: `Section "${sectionId}" was removed in ${Math.round(dropRate * 100)}% of successful runs -- content coverage may be degraded`,
              sectionRef: "what-section-coverage",
            });
          }
        }
      }

      // How -- prompt vs completion token breakdown
      const newslettersWithTokenBreakdown = newsletters.filter(
        (n) => n.promptTokens !== null && n.completionTokens !== null,
      );
      if (newslettersWithTokenBreakdown.length > 0) {
        const totalPromptTokens = newslettersWithTokenBreakdown.reduce(
          (sum, n) => sum + (n.promptTokens ?? 0),
          0,
        );
        const totalCompletionTokens = newslettersWithTokenBreakdown.reduce(
          (sum, n) => sum + (n.completionTokens ?? 0),
          0,
        );
        const promptPlusCompletion = totalPromptTokens + totalCompletionTokens;

        sections.push({
          id: "how-prompt-vs-completion-tokens",
          category: "how",
          title: "Prompt vs completion token split",
          insight:
            "Breakdown of prompt and completion tokens across newsletters that have both values. Prompt + completion should reconcile to total when both are present.",
          widget: {
            kind: "breakdown",
            slices: [
              {
                label: "Prompt",
                value: totalPromptTokens,
                fraction:
                  promptPlusCompletion > 0
                    ? totalPromptTokens / promptPlusCompletion
                    : 0,
              },
              {
                label: "Completion",
                value: totalCompletionTokens,
                fraction:
                  promptPlusCompletion > 0
                    ? totalCompletionTokens / promptPlusCompletion
                    : 0,
              },
            ],
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

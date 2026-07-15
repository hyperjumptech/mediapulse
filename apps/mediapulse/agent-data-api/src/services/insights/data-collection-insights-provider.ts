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

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type RunRow = {
  id: string;
  tickerId: string | null;
  startedAt: Date;
  status: string;
  snapshot: Prisma.JsonValue | null | undefined;
};

type FailureRow = {
  runId: string;
  stage: string;
  provider: string;
  errorCategory: string;
};

type DataSourceRow = {
  tickerId: string | null;
  url: string;
  createdAt: Date;
  ticker: { symbol: string } | null;
};

type DataCollectionInsightsDeps = {
  dataCollectionRun: {
    findMany: (args: {
      where: {
        startedAt: { gte: Date };
        tickerId?: string;
      };
      orderBy: { startedAt: "asc" };
      select: {
        id: boolean;
        tickerId: boolean;
        startedAt: boolean;
        status: boolean;
        snapshot: boolean;
      };
    }) => Promise<RunRow[]>;
  };
  dataCollectionFailure: {
    findMany: (args: {
      where: { runId: { in: string[] } };
      select: {
        runId: boolean;
        stage: boolean;
        provider: boolean;
        errorCategory: boolean;
      };
    }) => Promise<FailureRow[]>;
  };
  dataSource: {
    findMany: (args: {
      where: { createdAt: { gte: Date }; tickerId?: string };
      select: {
        tickerId: boolean;
        url: boolean;
        createdAt: boolean;
        ticker: { select: { symbol: boolean } };
      };
      take: number;
    }) => Promise<DataSourceRow[]>;
  };
};

type RunSnapshot = {
  agentId?: string;
  cost?: { searchCredits?: number };
  result?: {
    saved?: number;
    excluded?: number;
    byReason?: Record<string, number>;
  };
  timing?: { totalMs?: number; roundsExecuted?: number; stopReason?: string };
};

function parseSnapshot(raw: Prisma.JsonValue | null | undefined): RunSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as RunSnapshot;
}

function isDataCollectionRun(row: RunRow): boolean {
  return parseSnapshot(row.snapshot).agentId === "data-collection";
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

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
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

export function createDataCollectionInsightsProvider(
  deps: DataCollectionInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "data-collection",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const [allRuns, dataSources] = await Promise.all([
        deps.dataCollectionRun.findMany({
          where: {
            startedAt: { gte: priorStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            tickerId: true,
            startedAt: true,
            status: true,
            snapshot: true,
          },
        }),
        deps.dataSource.findMany({
          where: {
            createdAt: { gte: windowStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          select: {
            tickerId: true,
            url: true,
            createdAt: true,
            ticker: { select: { symbol: true } },
          },
          take: 2000,
        }),
      ]);

      // Scope to data-collection runs only
      const runs = allRuns.filter(
        (r) => r.startedAt >= windowStart && isDataCollectionRun(r),
      );
      const priorWindowRuns = allRuns.filter(
        (r) =>
          r.startedAt >= priorStart &&
          r.startedAt < windowStart &&
          isDataCollectionRun(r),
      );

      const windowRunIds = runs.map((r) => r.id);
      const failures =
        windowRunIds.length > 0
          ? await deps.dataCollectionFailure.findMany({
              where: { runId: { in: windowRunIds } },
              select: {
                runId: true,
                stage: true,
                provider: true,
                errorCategory: true,
              },
            })
          : [];

      // ─── Aggregated counters ─────────────────────────────────────────────

      const totalRuns = runs.length;
      const successfulRuns = runs.filter(
        (r) => r.status === "success" || r.status === "partial_success",
      ).length;
      const savedOf = (r: RunRow): number =>
        parseSnapshot(r.snapshot).result?.saved ?? 0;
      const totalArticles = runs.reduce((sum, r) => sum + savedOf(r), 0);
      const priorArticles = priorWindowRuns.reduce(
        (sum, r) => sum + savedOf(r),
        0,
      );

      let totalExcluded = 0;
      let totalSearchCredits = 0;
      const totalByReason: Record<string, number> = {};
      const durationMsList: number[] = [];

      for (const run of runs) {
        const snap = parseSnapshot(run.snapshot);
        totalExcluded += snap.result?.excluded ?? 0;
        totalSearchCredits += snap.cost?.searchCredits ?? 0;
        for (const [reason, count] of Object.entries(
          snap.result?.byReason ?? {},
        )) {
          totalByReason[reason] = (totalByReason[reason] ?? 0) + count;
        }
        if (snap.timing?.totalMs !== undefined) {
          durationMsList.push(snap.timing.totalMs);
        }
      }

      // ─── KPIs ────────────────────────────────────────────────────────────

      const successRate =
        totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
      const totalConsidered = totalArticles + totalExcluded;
      const dropRate =
        totalConsidered > 0
          ? Math.round((totalExcluded / totalConsidered) * 100)
          : 0;
      const articleDelta = totalArticles - priorArticles;
      const medianDurationMs = medianOf(durationMsList);

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
          id: "articles_collected",
          label: "Articles collected",
          value: totalArticles,
          delta: articleDelta,
        },
        ...(totalConsidered > 0
          ? [
              {
                id: "drop_rate",
                label: "Drop rate",
                value: dropRate,
                unit: "%",
                tone:
                  dropRate >= 70
                    ? ("critical" as const)
                    : dropRate >= 40
                      ? ("warning" as const)
                      : ("neutral" as const),
              } satisfies KpiCard,
            ]
          : []),
        ...(medianDurationMs !== null
          ? [
              {
                id: "median_duration_ms",
                label: "Median run duration",
                value: medianDurationMs,
                unit: "ms",
              } satisfies KpiCard,
            ]
          : []),
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      if (failures.length > 0) {
        const stageFailCounts = new Map<string, number>();
        for (const f of failures) {
          stageFailCounts.set(f.stage, (stageFailCounts.get(f.stage) ?? 0) + 1);
        }
        for (const [stage, count] of stageFailCounts) {
          if (count > 5) {
            const stageFailures = failures.filter((f) => f.stage === stage);
            const catCounts = new Map<string, number>();
            for (const f of stageFailures) {
              catCounts.set(
                f.errorCategory,
                (catCounts.get(f.errorCategory) ?? 0) + 1,
              );
            }
            const dominantCategory =
              [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
              "unknown";
            alerts.push({
              id: `stage-failure-${stage}`,
              severity: "warning",
              message: `${count} ${stage} failures in the window — most are "${dominantCategory}" errors.`,
              sectionRef: "why-failure-category",
            });
          }
        }
      }

      if (totalConsidered > 10 && dropRate > 60) {
        const dominant =
          Object.entries(totalByReason).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "unknown";
        alerts.push({
          id: "high-drop-rate",
          severity: "warning",
          message: `${dropRate}% of considered URLs were excluded before saving. The "${dominant}" reason accounts for most of the loss.`,
          sectionRef: "why-drop-reasons",
        });
      }

      if (totalRuns > 0) {
        const staleThresholdMs =
          ctx.window === "24h" ? 6 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
        const lastRun = runs[runs.length - 1];
        if (
          lastRun &&
          now.getTime() - lastRun.startedAt.getTime() > staleThresholdMs
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

      // What — collection funnel
      sections.push({
        id: "what-funnel",
        category: "what",
        title: "Collection funnel",
        insight: `Across ${totalRuns} run${totalRuns === 1 ? "" : "s"}, ${totalConsidered} URLs were considered; ${totalArticles} were saved and ${totalExcluded} excluded.`,
        widget: {
          kind: "funnel",
          stages: [
            { label: "Considered", value: totalConsidered },
            { label: "Saved", value: totalArticles },
          ],
        },
      });

      // When — articles per day
      const dailyBuckets = buildWindowDates(windowStart, now);
      for (const run of runs) {
        const dayKey = run.startedAt.toISOString().slice(0, 10);
        if (dailyBuckets.has(dayKey)) {
          dailyBuckets.set(
            dayKey,
            (dailyBuckets.get(dayKey) ?? 0) + savedOf(run),
          );
        }
      }
      sections.push({
        id: "when-timeseries",
        category: "when",
        title: "Articles over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(dailyBuckets.entries()).map(([ts, value]) => ({
            ts: `${ts}T00:00:00.000Z`,
            value,
          })),
          unit: "articles",
        },
      });

      // Where — top publishers by article count
      const publisherCounts = new Map<string, number>();
      for (const source of dataSources) {
        const publisher = domainFromUrl(source.url);
        publisherCounts.set(
          publisher,
          (publisherCounts.get(publisher) ?? 0) + 1,
        );
      }
      if (publisherCounts.size > 0) {
        const topPublishers = Array.from(publisherCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label]) => label);
        sections.push({
          id: "where-publishers",
          category: "where",
          title: "Articles by publisher",
          insight:
            topPublishers.length > 0
              ? `Top sources: ${topPublishers.join(", ")}.`
              : undefined,
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(publisherCounts.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "articles",
          },
        });
      }

      // Who — per-ticker article counts
      const tickerArticleCounts = new Map<string, number>();
      for (const source of dataSources) {
        if (source.ticker === null) {
          continue;
        }
        const symbol = source.ticker.symbol;
        tickerArticleCounts.set(
          symbol,
          (tickerArticleCounts.get(symbol) ?? 0) + 1,
        );
      }
      if (tickerArticleCounts.size > 0) {
        const topTickers = Array.from(tickerArticleCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([symbol]) => symbol);
        sections.push({
          id: "who-per-ticker",
          category: "who",
          title: "Articles by ticker",
          insight:
            topTickers.length > 0
              ? `Top tickers: ${topTickers.join(", ")}.`
              : undefined,
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(tickerArticleCounts.entries()).map(
                ([label, value]) => ({
                  label,
                  value,
                }),
              ),
              TOP_N,
            ),
            unit: "articles",
          },
        });
      }

      // Why — drop reason breakdown
      const dropEntries: Array<[string, number]> =
        Object.entries(totalByReason);
      const totalDroppedAll = dropEntries.reduce((sum, [, v]) => sum + v, 0);
      const dropReasons = dropEntries
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({
          label,
          value,
          fraction: totalDroppedAll > 0 ? value / totalDroppedAll : 0,
        }));
      if (dropReasons.length > 0) {
        sections.push({
          id: "why-drop-reasons",
          category: "why",
          title: "Drop reasons",
          widget: {
            kind: "breakdown",
            slices: dropReasons,
          },
        });
      }

      // Why — failure category breakdown
      if (failures.length > 0) {
        const failCatCounts = new Map<string, number>();
        for (const f of failures) {
          failCatCounts.set(
            f.errorCategory,
            (failCatCounts.get(f.errorCategory) ?? 0) + 1,
          );
        }
        const failTotal = failures.length;
        sections.push({
          id: "why-failure-category",
          category: "why",
          title: "Failure categories",
          widget: {
            kind: "breakdown",
            slices: Array.from(failCatCounts.entries()).map(
              ([label, value]) => ({
                label,
                value,
                fraction: failTotal > 0 ? value / failTotal : 0,
              }),
            ),
          },
        });
      }

      // How — provider mix (from failure stage/provider data)
      const providerMix = new Map<string, number>();
      for (const f of failures) {
        providerMix.set(f.provider, (providerMix.get(f.provider) ?? 0) + 1);
      }
      if (providerMix.size > 0) {
        const providerTotal = Array.from(providerMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "how-provider-mix",
          category: "how",
          title: "Provider failure mix",
          widget: {
            kind: "breakdown",
            slices: Array.from(providerMix.entries()).map(([label, value]) => ({
              label,
              value,
              fraction: providerTotal > 0 ? value / providerTotal : 0,
            })),
          },
        });
      }

      return {
        agentId: "data-collection",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

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
  tickerId: string | null;
  startedAt: Date;
  status: string;
  snapshot: Prisma.JsonValue | null;
};

type SourceHealthRow = {
  listingUrl: string;
  runDate: Date;
  discovered: boolean;
  itemCount: number;
  winningStrategy: string | null;
  failureCount: number;
};

type DataSourceRow = {
  tickerId: string | null;
  url: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  ticker: { symbol: string } | null;
};

type PageCollectionInsightsDeps = {
  dataCollectionRun: {
    findMany: (args: {
      where: {
        startedAt: { gte: Date };
        tickerId?: string;
      };
      orderBy: { startedAt: "asc" };
      select: {
        tickerId: boolean;
        startedAt: boolean;
        status: boolean;
        snapshot: boolean;
      };
    }) => Promise<RunRow[]>;
  };
  discoverySourceHealth: {
    findMany: (args: {
      where: { runDate: { gte: Date } };
      select: {
        listingUrl: boolean;
        runDate: boolean;
        discovered: boolean;
        itemCount: boolean;
        winningStrategy: boolean;
        failureCount: boolean;
      };
    }) => Promise<SourceHealthRow[]>;
  };
  dataSource: {
    findMany: (args: {
      where: { createdAt: { gte: Date }; tickerId?: string };
      select: {
        tickerId: boolean;
        url: boolean;
        createdAt: boolean;
        metadata: boolean;
        ticker: { select: { symbol: boolean } };
      };
      take: number;
    }) => Promise<DataSourceRow[]>;
  };
};

type RunSnapshot = {
  agentId?: string;
  cost?: { searchCredits?: number; fetchByProvider?: Record<string, number> };
  result?: {
    saved?: number;
    excluded?: number;
    byReason?: Record<string, number>;
  };
  timing?: { totalMs?: number; roundsExecuted?: number; stopReason?: string };
};

function parseSnapshot(raw: Prisma.JsonValue | null): RunSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as RunSnapshot;
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

export function createPageCollectionInsightsProvider(
  deps: PageCollectionInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "page-collection",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const [allRuns, priorRuns, sourceHealth, dataSources] = await Promise.all(
        [
          deps.dataCollectionRun.findMany({
            where: {
              startedAt: { gte: windowStart },
              ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
            },
            orderBy: { startedAt: "asc" },
            select: {
              tickerId: true,
              startedAt: true,
              status: true,
              snapshot: true,
            },
          }),
          deps.dataCollectionRun.findMany({
            where: {
              startedAt: { gte: priorStart },
              ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
            },
            orderBy: { startedAt: "asc" },
            select: {
              tickerId: true,
              startedAt: true,
              status: true,
              snapshot: true,
            },
          }),
          deps.discoverySourceHealth.findMany({
            where: { runDate: { gte: windowStart } },
            select: {
              listingUrl: true,
              runDate: true,
              discovered: true,
              itemCount: true,
              winningStrategy: true,
              failureCount: true,
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
              metadata: true,
              ticker: { select: { symbol: true } },
            },
            take: 2000,
          }),
        ],
      );

      // Scope to page-collection runs only (by the snapshot's agent id).
      const isPageCollectionRun = (r: RunRow) =>
        parseSnapshot(r.snapshot).agentId === "page-collection";

      const runs = allRuns.filter(isPageCollectionRun);
      const priorWindowRuns = priorRuns.filter(
        (r) =>
          r.startedAt >= priorStart &&
          r.startedAt < windowStart &&
          isPageCollectionRun(r),
      );

      // ─── Aggregated run counters ─────────────────────────────────────────

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

      let totalPersisted = 0;
      let totalExcluded = 0;
      const totalByReason: Record<string, number> = {};

      for (const run of runs) {
        const snap = parseSnapshot(run.snapshot);
        totalPersisted += snap.result?.saved ?? 0;
        totalExcluded += snap.result?.excluded ?? 0;
        for (const [reason, count] of Object.entries(
          snap.result?.byReason ?? {},
        )) {
          totalByReason[reason] = (totalByReason[reason] ?? 0) + count;
        }
      }

      // ─── KPIs ────────────────────────────────────────────────────────────

      const successRate =
        totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

      const totalConsidered = totalPersisted + totalExcluded;
      const dropRate =
        totalConsidered > 0
          ? Math.round((totalExcluded / totalConsidered) * 100)
          : 0;

      const priorRunCount = priorWindowRuns.length;
      const articleDelta = totalArticles - priorArticles;

      const uniqueSources = new Set(sourceHealth.map((r) => r.listingUrl)).size;
      const failedSources = new Set(
        sourceHealth
          .filter((r) => !r.discovered && r.failureCount > 0)
          .map((r) => r.listingUrl),
      ).size;
      const healthySources = uniqueSources - failedSources;

      const kpis: KpiCard[] = [
        {
          id: "runs",
          label: "Runs",
          value: totalRuns,
          delta: totalRuns - priorRunCount,
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
        {
          id: "healthy_sources",
          label: "Healthy sources",
          value: `${healthySources}/${uniqueSources}`,
        },
        ...(totalConsidered > 0
          ? [
              {
                id: "drop_rate",
                label: "Drop rate",
                value: dropRate,
                unit: "%",
              } satisfies KpiCard,
            ]
          : []),
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      const sourceFailureCounts = new Map<string, number>();
      for (const record of sourceHealth) {
        if (!record.discovered) {
          sourceFailureCounts.set(
            record.listingUrl,
            (sourceFailureCounts.get(record.listingUrl) ?? 0) + 1,
          );
        }
      }
      for (const [url, count] of sourceFailureCounts) {
        if (count >= 3) {
          alerts.push({
            id: `consecutive-fail-${domainFromUrl(url)}`,
            severity: "warning",
            message: `${domainFromUrl(url)} failed discovery for ${count} consecutive days`,
            sectionRef: "where-source-health",
          });
        }
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

      if (totalConsidered > 10 && dropRate > 50) {
        alerts.push({
          id: "high-drop-rate",
          severity: "warning",
          message: `${dropRate}% of considered URLs were excluded before saving.`,
          sectionRef: "why-drops",
        });
      }

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      // What — funnel
      sections.push({
        id: "what-funnel",
        category: "what",
        title: "Collection funnel",
        insight:
          "Articles discovered through the pipeline to final persistence.",
        widget: {
          kind: "funnel",
          stages: [
            { label: "Considered", value: totalConsidered },
            { label: "Saved", value: totalPersisted },
          ],
        },
      });

      // When — time series (articles persisted per day)
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

      // When — freshness histogram (days since discovery vs count of articles)
      const freshnessHistogram = new Map([
        ["same day", 0],
        ["1-2 days", 0],
        ["3-7 days", 0],
        ["8-30 days", 0],
        [">30 days", 0],
      ]);
      for (const source of dataSources) {
        const ageDays =
          (now.getTime() - source.createdAt.getTime()) / (24 * 60 * 60 * 1000);
        if (ageDays < 1)
          freshnessHistogram.set(
            "same day",
            (freshnessHistogram.get("same day") ?? 0) + 1,
          );
        else if (ageDays <= 2)
          freshnessHistogram.set(
            "1-2 days",
            (freshnessHistogram.get("1-2 days") ?? 0) + 1,
          );
        else if (ageDays <= 7)
          freshnessHistogram.set(
            "3-7 days",
            (freshnessHistogram.get("3-7 days") ?? 0) + 1,
          );
        else if (ageDays <= 30)
          freshnessHistogram.set(
            "8-30 days",
            (freshnessHistogram.get("8-30 days") ?? 0) + 1,
          );
        else
          freshnessHistogram.set(
            ">30 days",
            (freshnessHistogram.get(">30 days") ?? 0) + 1,
          );
      }
      if (dataSources.length > 0) {
        sections.push({
          id: "when-freshness",
          category: "when",
          title: "Article freshness",
          widget: {
            kind: "histogram",
            buckets: Array.from(freshnessHistogram.entries()).map(
              ([label, count]) => ({ label, count }),
            ),
          },
        });
      }

      // Where — source bar (top sources by item count)
      const sourceItemCounts = new Map<string, number>();
      for (const record of sourceHealth) {
        const domain = domainFromUrl(record.listingUrl);
        sourceItemCounts.set(
          domain,
          (sourceItemCounts.get(domain) ?? 0) + record.itemCount,
        );
      }
      if (sourceItemCounts.size > 0) {
        sections.push({
          id: "where-source-bar",
          category: "where",
          title: "Items by source",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(sourceItemCounts.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "items",
          },
        });
      }

      // Where — source health table (aggregated by domain)
      const sourceHealthByDomain = new Map<
        string,
        { discovered: number; failed: number }
      >();
      for (const record of sourceHealth) {
        const domain = domainFromUrl(record.listingUrl);
        const existing = sourceHealthByDomain.get(domain) ?? {
          discovered: 0,
          failed: 0,
        };
        sourceHealthByDomain.set(domain, {
          discovered: existing.discovered + (record.discovered ? 1 : 0),
          failed: existing.failed + (record.discovered ? 0 : 1),
        });
      }
      if (sourceHealthByDomain.size > 0) {
        const healthRows = bucketTopN(
          Array.from(sourceHealthByDomain.entries()).map(([domain, stats]) => ({
            label: domain,
            value: stats.discovered,
          })),
          TOP_N,
        );
        sections.push({
          id: "where-source-health",
          category: "where",
          title: "Source health",
          widget: {
            kind: "table",
            columns: ["Source", "Discovered days", "Failed days"],
            rows: healthRows.map((row) => {
              const stats = sourceHealthByDomain.get(row.label);
              return [row.label, stats?.discovered ?? 0, stats?.failed ?? 0];
            }),
          },
        });
      }

      // Who — per-ticker bar
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
        sections.push({
          id: "who-per-ticker",
          category: "who",
          title: "Articles by ticker",
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

      // Who — per-publisher bar (domain of data source URL)
      const publisherCounts = new Map<string, number>();
      for (const source of dataSources) {
        const publisher = domainFromUrl(source.url);
        publisherCounts.set(
          publisher,
          (publisherCounts.get(publisher) ?? 0) + 1,
        );
      }
      if (publisherCounts.size > 0) {
        sections.push({
          id: "who-per-publisher",
          category: "who",
          title: "Articles by publisher",
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

      // Why — drop reason breakdown
      const dropReasons: Array<{
        label: string;
        value: number;
        fraction: number;
      }> = [];
      const dropEntries: Array<[string, number]> =
        Object.entries(totalByReason);
      const totalDropped = dropEntries.reduce((sum, [, v]) => sum + v, 0);
      for (const [label, value] of dropEntries) {
        if (value > 0) {
          dropReasons.push({
            label,
            value,
            fraction: totalDropped > 0 ? value / totalDropped : 0,
          });
        }
      }
      if (dropReasons.length > 0) {
        sections.push({
          id: "why-drops",
          category: "why",
          title: "Drop reasons",
          widget: {
            kind: "breakdown",
            slices: dropReasons,
          },
        });
      }

      // How — discovery strategy mix
      const strategyMix = new Map<string, number>();
      for (const record of sourceHealth) {
        if (record.winningStrategy) {
          strategyMix.set(
            record.winningStrategy,
            (strategyMix.get(record.winningStrategy) ?? 0) + 1,
          );
        }
      }
      if (strategyMix.size > 0) {
        const strategyTotal = Array.from(strategyMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "how-strategy-mix",
          category: "how",
          title: "Discovery strategy mix",
          widget: {
            kind: "breakdown",
            slices: Array.from(strategyMix.entries()).map(([label, value]) => ({
              label,
              value,
              fraction: strategyTotal > 0 ? value / strategyTotal : 0,
            })),
          },
        });
      }

      // How — fetch provider mix
      const providerMix = new Map<string, number>();
      for (const source of dataSources) {
        const meta =
          source.metadata &&
          typeof source.metadata === "object" &&
          !Array.isArray(source.metadata)
            ? (source.metadata as { provider?: string })
            : null;
        if (meta?.provider) {
          providerMix.set(
            meta.provider,
            (providerMix.get(meta.provider) ?? 0) + 1,
          );
        }
      }
      if (providerMix.size > 0) {
        const providerTotal = Array.from(providerMix.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "how-provider-mix",
          category: "how",
          title: "Fetch provider mix",
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
        agentId: "page-collection",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

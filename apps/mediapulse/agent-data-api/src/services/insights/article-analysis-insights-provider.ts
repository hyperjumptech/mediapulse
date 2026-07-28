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

// Threshold constants reconciled with alert thresholds
const SELECTION_RATE_CRITICAL_THRESHOLD = 20; // matches low-selection-rate alert
const SELECTION_RATE_WARNING_THRESHOLD = 40;
const AVG_SCORE_LOW_THRESHOLD = 0.3; // matches low-avg-score alert

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type ArticleRelevanceRow = {
  dataSourceId: string;
  tickerId: string;
  ticker: { symbol: string };
  score: number;
  scoreBreakdown: unknown;
  selected: boolean;
  scoredAt: Date;
};

type ArticleAnalysisInsightsDeps = {
  articleRelevance: {
    findMany: (args: {
      where: {
        scoredAt: { gte: Date };
        tickerId?: string;
      };
      select: {
        dataSourceId: boolean;
        tickerId: boolean;
        ticker: { select: { symbol: boolean } };
        score: boolean;
        scoreBreakdown: boolean;
        selected: boolean;
        scoredAt: boolean;
      };
      orderBy: { scoredAt: "asc" };
      take?: number;
    }) => Promise<ArticleRelevanceRow[]>;
  };
};

type ScoreBreakdown = {
  _version: number;
  fundamental: number;
  breakingNews: number;
  sourceQuality: number;
  tickerSalience: number;
};

function parseScoreBreakdown(raw: unknown): ScoreBreakdown | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["_version"] !== "number") return null;
  if (
    typeof obj["fundamental"] !== "number" ||
    typeof obj["breakingNews"] !== "number" ||
    typeof obj["sourceQuality"] !== "number" ||
    typeof obj["tickerSalience"] !== "number"
  ) {
    return null;
  }

  return {
    _version: obj["_version"],
    fundamental: obj["fundamental"],
    breakingNews: obj["breakingNews"],
    sourceQuality: obj["sourceQuality"],
    tickerSalience: obj["tickerSalience"],
  };
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

export function createArticleAnalysisInsightsProvider(
  deps: ArticleAnalysisInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "article-analysis",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const allRelevance = await deps.articleRelevance.findMany({
        where: {
          scoredAt: { gte: priorStart },
          ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
        },
        select: {
          dataSourceId: true,
          tickerId: true,
          ticker: { select: { symbol: true } },
          score: true,
          scoreBreakdown: true,
          selected: true,
          scoredAt: true,
        },
        orderBy: { scoredAt: "asc" },
        take: 5000,
      });

      // Split into current and prior windows
      const relevance = allRelevance.filter((r) => r.scoredAt >= windowStart);
      const priorRelevance = allRelevance.filter(
        (r) => r.scoredAt >= priorStart && r.scoredAt < windowStart,
      );
      // ─── Aggregated metrics ──────────────────────────────────────────────

      const uniqueArticleIds = new Set(relevance.map((r) => r.dataSourceId));
      const totalArticlesScored = uniqueArticleIds.size;
      const totalSelected = relevance.filter((r) => r.selected).length;
      const priorUniqueArticleIds = new Set(
        priorRelevance.map((r) => r.dataSourceId),
      );
      const priorArticlesScored = priorUniqueArticleIds.size;
      const priorSelected = priorRelevance.filter((r) => r.selected).length;
      const selectionRate =
        totalArticlesScored > 0
          ? Math.round((totalSelected / relevance.length) * 100)
          : 0;

      const avgScore =
        relevance.length > 0
          ? Math.round(
              (relevance.reduce((sum, r) => sum + r.score, 0) /
                relevance.length) *
                100,
            ) / 100
          : 0;

      // ─── KPI tones ───────────────────────────────────────────────────────

      const selectionRateTone: KpiCard["tone"] =
        selectionRate < SELECTION_RATE_CRITICAL_THRESHOLD
          ? "critical"
          : selectionRate < SELECTION_RATE_WARNING_THRESHOLD
            ? "warning"
            : "positive";

      const avgScoreTone: KpiCard["tone"] =
        avgScore < AVG_SCORE_LOW_THRESHOLD ? "critical" : "warning";

      // ─── KPIs ────────────────────────────────────────────────────────────

      const kpis: KpiCard[] = [
        {
          id: "articles_scored",
          label: "Articles scored",
          value: totalArticlesScored,
          delta: totalArticlesScored - priorArticlesScored,
        },
        {
          id: "articles_selected",
          label: "Articles selected",
          value: totalSelected,
          delta: totalSelected - priorSelected,
        },
        {
          id: "selection_rate",
          label: "Selection rate",
          value: selectionRate,
          unit: "%",
          tone: selectionRateTone,
        },
        {
          id: "avg_relevance_score",
          label: "Avg relevance score",
          value: avgScore,
          tone: avgScoreTone,
        },
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      if (totalArticlesScored > 10 && selectionRate < 20) {
        alerts.push({
          id: "low-selection-rate",
          severity: "warning",
          message: `Selection rate is low: ${selectionRate}% of scored articles selected`,
          sectionRef: "what-scoring-funnel",
        });
      }

      if (avgScore < 0.3 && relevance.length > 5) {
        alerts.push({
          id: "low-avg-score",
          severity: "info",
          message: `Average relevance score is low: ${avgScore.toFixed(2)}`,
          sectionRef: "why-score-distribution",
        });
      }

      if (relevance.length > 0) {
        const staleThresholdMs =
          ctx.window === "24h" ? 6 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
        const lastRow = relevance[relevance.length - 1];
        if (
          lastRow &&
          now.getTime() - lastRow.scoredAt.getTime() > staleThresholdMs
        ) {
          alerts.push({
            id: "stale-last-analysis",
            severity: "info",
            message: `No articles analyzed in the last ${ctx.window === "24h" ? "6 hours" : "48 hours"}`,
          });
        }
      }

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      sections.push({
        id: "what-scoring-funnel",
        category: "what",
        title: "Scoring funnel",
        insight: "From scored articles through to selection for delivery.",
        widget: {
          kind: "funnel",
          stages: [
            { label: "Scored", value: relevance.length },
            { label: "Selected", value: totalSelected },
          ],
        },
      });

      // When — articles scored per day
      const dailyBuckets = buildWindowDates(windowStart, now);
      for (const row of relevance) {
        const dayKey = row.scoredAt.toISOString().slice(0, 10);
        if (dailyBuckets.has(dayKey)) {
          dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) ?? 0) + 1);
        }
      }
      sections.push({
        id: "when-timeseries",
        category: "when",
        title: "Articles scored over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(dailyBuckets.entries()).map(([ts, value]) => ({
            ts: `${ts}T00:00:00.000Z`,
            value,
          })),
          unit: "articles",
        },
      });

      // Where — articles scored per ticker
      const tickerCounts = new Map<string, number>();
      for (const row of relevance) {
        const label = row.ticker?.symbol ?? row.tickerId;
        tickerCounts.set(label, (tickerCounts.get(label) ?? 0) + 1);
      }
      if (tickerCounts.size > 0) {
        sections.push({
          id: "where-per-ticker",
          category: "where",
          title: "Articles scored by ticker",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(tickerCounts.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "articles",
          },
        });
      }

      // Why — relevance score distribution histogram
      if (relevance.length > 0) {
        const bucketCount = 5;
        const histBuckets: number[] = Array(bucketCount).fill(0);
        for (const row of relevance) {
          const bucketIdx = Math.min(
            Math.floor(row.score * bucketCount),
            bucketCount - 1,
          );
          histBuckets[bucketIdx] = (histBuckets[bucketIdx] ?? 0) + 1;
        }
        const bucketLabels = [
          "0-0.2",
          "0.2-0.4",
          "0.4-0.6",
          "0.6-0.8",
          "0.8-1.0",
        ];
        sections.push({
          id: "why-score-distribution",
          category: "why",
          title: "Relevance score distribution",
          widget: {
            kind: "histogram",
            buckets: histBuckets.map((count, i) => ({
              label: bucketLabels[i] ?? `${i}`,
              count,
            })),
          },
        });
      }

      // Why — score composition breakdown
      const parsedBreakdowns = relevance
        .map((r) => parseScoreBreakdown(r.scoreBreakdown))
        .filter((b): b is ScoreBreakdown => b !== null);

      if (parsedBreakdowns.length > 0) {
        const count = parsedBreakdowns.length;
        const avgFundamental =
          parsedBreakdowns.reduce((sum, b) => sum + b.fundamental, 0) / count;
        const avgBreakingNews =
          parsedBreakdowns.reduce((sum, b) => sum + b.breakingNews, 0) / count;
        const avgSourceQuality =
          parsedBreakdowns.reduce((sum, b) => sum + b.sourceQuality, 0) / count;
        const avgTickerSalience =
          parsedBreakdowns.reduce((sum, b) => sum + b.tickerSalience, 0) /
          count;

        const componentAverages: Array<{ label: string; value: number }> = [
          { label: "Fundamental", value: avgFundamental },
          { label: "Breaking news", value: avgBreakingNews },
          { label: "Source quality", value: avgSourceQuality },
          { label: "Ticker salience", value: avgTickerSalience },
        ];

        const dominantComponent = componentAverages.reduce((best, current) =>
          current.value > best.value ? current : best,
        );

        const total = componentAverages.reduce(
          (sum, component) => sum + component.value,
          0,
        );

        sections.push({
          id: "why-score-composition",
          category: "why",
          title: "Score composition",
          insight: `The dominant scoring driver is ${dominantComponent.label.toLowerCase()} (avg ${dominantComponent.value.toFixed(2)}).`,
          widget: {
            kind: "breakdown",
            slices: componentAverages.map((component) => ({
              label: component.label,
              value: component.value,
              fraction: total > 0 ? component.value / total : 0,
            })),
          },
        });
      }

      return {
        agentId: "article-analysis",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

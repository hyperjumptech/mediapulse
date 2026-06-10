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

type ArticleRelevanceRow = {
  dataSourceId: string;
  tickerId: string;
  score: number;
  selected: boolean;
  scoredAt: Date;
};

type ArticleEntityRow = {
  entityId: string;
  mentionCount: number;
  confidence: number;
  sentiment: string | null;
  createdAt: Date;
  entity: { canonicalName: string };
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
        score: boolean;
        selected: boolean;
        scoredAt: boolean;
      };
      orderBy: { scoredAt: "asc" };
      take?: number;
    }) => Promise<ArticleRelevanceRow[]>;
  };
  articleEntity: {
    findMany: (args: {
      where: { createdAt: { gte: Date } };
      select: {
        entityId: boolean;
        mentionCount: boolean;
        confidence: boolean;
        sentiment: boolean;
        createdAt: boolean;
        entity: { select: { canonicalName: boolean } };
      };
      take?: number;
    }) => Promise<ArticleEntityRow[]>;
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

      const [allRelevance, allEntities] = await Promise.all([
        deps.articleRelevance.findMany({
          where: {
            scoredAt: { gte: priorStart },
            ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
          },
          select: {
            dataSourceId: true,
            tickerId: true,
            score: true,
            selected: true,
            scoredAt: true,
          },
          orderBy: { scoredAt: "asc" },
          take: 5000,
        }),
        deps.articleEntity.findMany({
          where: { createdAt: { gte: priorStart } },
          select: {
            entityId: true,
            mentionCount: true,
            confidence: true,
            sentiment: true,
            createdAt: true,
            entity: { select: { canonicalName: true } },
          },
          take: 5000,
        }),
      ]);

      // Split into current and prior windows
      const relevance = allRelevance.filter((r) => r.scoredAt >= windowStart);
      const priorRelevance = allRelevance.filter(
        (r) => r.scoredAt >= priorStart && r.scoredAt < windowStart,
      );
      const entities = allEntities.filter((e) => e.createdAt >= windowStart);
      const priorEntities = allEntities.filter(
        (e) => e.createdAt >= priorStart && e.createdAt < windowStart,
      );

      // ─── Aggregated metrics ──────────────────────────────────────────────

      const uniqueArticleIds = new Set(relevance.map((r) => r.dataSourceId));
      const totalArticlesScored = uniqueArticleIds.size;
      const totalSelected = relevance.filter((r) => r.selected).length;
      const totalEntities = entities.reduce(
        (sum, e) => sum + e.mentionCount,
        0,
      );

      const priorUniqueArticleIds = new Set(
        priorRelevance.map((r) => r.dataSourceId),
      );
      const priorArticlesScored = priorUniqueArticleIds.size;
      const priorSelected = priorRelevance.filter((r) => r.selected).length;
      const priorEntityMentions = priorEntities.reduce(
        (sum, e) => sum + e.mentionCount,
        0,
      );

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
        },
        {
          id: "avg_relevance_score",
          label: "Avg relevance score",
          value: avgScore,
        },
        {
          id: "entity_mentions",
          label: "Entity mentions",
          value: totalEntities,
          delta: totalEntities - priorEntityMentions,
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

      // What — scoring funnel
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
        tickerCounts.set(
          row.tickerId,
          (tickerCounts.get(row.tickerId) ?? 0) + 1,
        );
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

      // Who — top entities by total mention count
      const entityMentionCounts = new Map<string, number>();
      const entityNames = new Map<string, string>();
      for (const row of entities) {
        const existing = entityMentionCounts.get(row.entityId) ?? 0;
        entityMentionCounts.set(row.entityId, existing + row.mentionCount);
        entityNames.set(row.entityId, row.entity.canonicalName);
      }
      if (entityMentionCounts.size > 0) {
        sections.push({
          id: "who-top-entities",
          category: "who",
          title: "Top entities by mentions",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(entityMentionCounts.entries()).map(([id, value]) => ({
                label: entityNames.get(id) ?? id,
                value,
              })),
              TOP_N,
            ),
            unit: "mentions",
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
          "0–0.2",
          "0.2–0.4",
          "0.4–0.6",
          "0.6–0.8",
          "0.8–1.0",
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

      // How — sentiment breakdown of extracted entities
      if (entities.length > 0) {
        const sentimentCounts = new Map<string, number>();
        for (const row of entities) {
          const key = row.sentiment ?? "neutral";
          sentimentCounts.set(
            key,
            (sentimentCounts.get(key) ?? 0) + row.mentionCount,
          );
        }
        const sentimentTotal = Array.from(sentimentCounts.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "how-entity-sentiment",
          category: "how",
          title: "Entity sentiment breakdown",
          widget: {
            kind: "breakdown",
            slices: Array.from(sentimentCounts.entries()).map(
              ([label, value]) => ({
                label:
                  label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
                value,
                fraction: sentimentTotal > 0 ? value / sentimentTotal : 0,
              }),
            ),
          },
        });
      }

      // How — selection rate stat
      if (relevance.length > 0) {
        sections.push({
          id: "how-selection-rate",
          category: "how",
          title: "Selection rate",
          widget: {
            kind: "stat",
            value: selectionRate,
            unit: "%",
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

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

const DIVERSITY_WARNING_THRESHOLD = 0.5;
const ZERO_YIELD_WARNING_THRESHOLD = 0.5;

const WINDOW_MS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

type QuerySetRow = {
  id: string;
  tickerId: string;
  generatedAt: Date;
  strategySnapshot: unknown;
};

type QueryRow = {
  id: string;
  setId: string | null;
  intent: string;
};

type YieldRow = {
  searchQueryId: string;
  runDate: Date;
  articleCount: number;
  novelArticleCount: number;
  searchQuery: {
    text: string;
    setId: string | null;
  };
};

type QueryAnalysisInsightsDeps = {
  searchQuerySet: {
    findMany: (args: {
      where: {
        generationSource: string;
        generatedAt: { gte: Date };
        tickerId?: string;
      };
      select: {
        id: boolean;
        tickerId: boolean;
        generatedAt: boolean;
        strategySnapshot: boolean;
      };
    }) => Promise<QuerySetRow[]>;
  };
  searchQuery: {
    findMany: (args: {
      where: {
        setId: { in: string[] };
      };
      select: {
        id: boolean;
        setId: boolean;
        intent: boolean;
      };
    }) => Promise<QueryRow[]>;
  };
  searchQueryYield: {
    findMany: (args: {
      where: {
        runDate: { gte: Date };
        searchQuery: { tickerId?: string };
      };
      select: {
        searchQueryId: boolean;
        runDate: boolean;
        articleCount: boolean;
        novelArticleCount: boolean;
        searchQuery: { select: { text: boolean; setId: boolean } };
      };
      orderBy: { novelArticleCount: "desc" };
      take: number;
    }) => Promise<YieldRow[]>;
  };
};

type DiversityScore = {
  lexicalDiversity?: number;
  intentCoverage?: number;
  personaCoverage?: number;
  semanticSpread?: number;
  composite?: number;
};

type LanguageQuota = {
  language: string;
  share: number;
};

type StrategySnapshot = {
  queryCount?: number;
  languageQuotas?: LanguageQuota[];
  minDeterministicCount?: number;
  personas?: string[];
  sectionCoverage?: { zeroCoverageSections?: string[] };
  selfCritiqueReplacedCount?: number;
  diversityScore?: DiversityScore;
  queryAttribution?: Array<{
    text?: string;
    source?: string;
    intent?: string;
    persona?: string;
  }>;
};

function parseStrategySnapshot(raw: unknown): StrategySnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as StrategySnapshot;
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

export function createQueryAnalysisInsightsProvider(
  deps: QueryAnalysisInsightsDeps,
): AgentInsightsProvider {
  return {
    agentId: "query-analysis",

    async compute(ctx: InsightsContext): Promise<InsightsPayload> {
      const windowMs = WINDOW_MS[ctx.window];
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);
      const priorStart = new Date(windowStart.getTime() - windowMs);

      const setFilter = {
        generationSource: "hybrid_v1",
        generatedAt: { gte: priorStart },
        ...(ctx.tickerId ? { tickerId: ctx.tickerId } : {}),
      };

      const [allSets, yieldRows] = await Promise.all([
        deps.searchQuerySet.findMany({
          where: setFilter,
          select: {
            id: true,
            tickerId: true,
            generatedAt: true,
            strategySnapshot: true,
          },
        }),
        deps.searchQueryYield.findMany({
          where: {
            runDate: { gte: windowStart },
            searchQuery: ctx.tickerId ? { tickerId: ctx.tickerId } : {},
          },
          select: {
            searchQueryId: true,
            runDate: true,
            articleCount: true,
            novelArticleCount: true,
            searchQuery: { select: { text: true, setId: true } },
          },
          orderBy: { novelArticleCount: "desc" },
          take: 200,
        }),
      ]);

      const currentSets = allSets.filter((s) => s.generatedAt >= windowStart);
      const priorSets = allSets.filter(
        (s) => s.generatedAt >= priorStart && s.generatedAt < windowStart,
      );

      const allSetIds = allSets.map((s) => s.id);
      const queries =
        allSetIds.length > 0
          ? await deps.searchQuery.findMany({
              where: { setId: { in: allSetIds } },
              select: { id: true, setId: true, intent: true },
            })
          : [];

      const currentSetIds = new Set(currentSets.map((s) => s.id));
      const currentQueries = queries.filter(
        (q) => q.setId !== null && currentSetIds.has(q.setId),
      );

      // ─── Strategy snapshot aggregation ──────────────────────────────────

      const snapshots = currentSets.map((s) =>
        parseStrategySnapshot(s.strategySnapshot),
      );

      const totalSets = currentSets.length;
      const priorSetCount = priorSets.length;

      const queriesPerSet =
        totalSets > 0 ? currentQueries.length / totalSets : 0;

      // Composite diversity score: window average and latest-set value
      const sortedSets = [...currentSets].sort(
        (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
      );
      const latestSet = sortedSets[0] ?? null;
      const latestSnapshot = latestSet
        ? parseStrategySnapshot(latestSet.strategySnapshot)
        : null;
      const latestDiversityScore =
        latestSnapshot?.diversityScore?.composite ?? null;

      const compositeScores = snapshots
        .map((s) => s.diversityScore?.composite)
        .filter((v): v is number => typeof v === "number");
      const windowAvgDiversityScore =
        compositeScores.length > 0
          ? compositeScores.reduce((sum, v) => sum + v, 0) /
            compositeScores.length
          : null;

      // ─── KPIs ────────────────────────────────────────────────────────────

      const kpis: KpiCard[] = [
        {
          id: "sets_generated",
          label: "Query sets generated",
          value: totalSets,
          delta: totalSets - priorSetCount,
        },
        {
          id: "avg_queries_per_set",
          label: "Avg queries / set",
          value: Math.round(queriesPerSet),
        },
        ...(windowAvgDiversityScore !== null
          ? [
              {
                id: "diversity_score",
                label: "Diversity score (window avg)",
                value: Math.round(windowAvgDiversityScore * 100) / 100,
                tone:
                  windowAvgDiversityScore < DIVERSITY_WARNING_THRESHOLD
                    ? "warning"
                    : "positive",
              } satisfies KpiCard,
            ]
          : []),
      ];

      // ─── Alerts ──────────────────────────────────────────────────────────

      const alerts: InsightAlert[] = [];

      if (latestDiversityScore !== null && latestDiversityScore < 0.5) {
        alerts.push({
          id: "low-diversity-score",
          severity: "warning",
          message: `Latest composite diversity score is low (${Math.round(latestDiversityScore * 100) / 100} < 0.5)`,
          sectionRef: "why-diversity",
        });
      }

      // Recurring zero-coverage sections (present in >50% of sets with the field).
      const zeroCoverageFrequency = new Map<string, number>();
      let setsWithCoverage = 0;
      for (const snap of snapshots) {
        const zeroCoverage = snap.sectionCoverage?.zeroCoverageSections;
        if (!Array.isArray(zeroCoverage)) continue;
        setsWithCoverage += 1;
        for (const section of zeroCoverage) {
          zeroCoverageFrequency.set(
            section,
            (zeroCoverageFrequency.get(section) ?? 0) + 1,
          );
        }
      }
      for (const [section, count] of zeroCoverageFrequency) {
        if (setsWithCoverage > 0 && count / setsWithCoverage > 0.5) {
          alerts.push({
            id: `zero-coverage-${section}`,
            severity: "warning",
            message: `Section "${section}" has zero coverage in ${count} of ${setsWithCoverage} sets`,
          });
        }
      }

      // High self-critique drop
      const totalSelfCritiqueDrops = snapshots.reduce(
        (sum, s) => sum + (s.selfCritiqueReplacedCount ?? 0),
        0,
      );
      if (totalSets > 0 && totalSelfCritiqueDrops / totalSets > 5) {
        alerts.push({
          id: "high-self-critique-drop",
          severity: "info",
          message: `High self-critique replacement rate: avg ${Math.round(totalSelfCritiqueDrops / totalSets)} replacements/set`,
        });
      }

      // Stale last set
      if (totalSets > 0) {
        const staleThresholdMs =
          ctx.window === "24h" ? 6 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
        const lastSet = sortedSets[0];
        if (
          lastSet &&
          now.getTime() - lastSet.generatedAt.getTime() > staleThresholdMs
        ) {
          alerts.push({
            id: "stale-last-set",
            severity: "info",
            message: `No query set generated in the last ${ctx.window === "24h" ? "6 hours" : "48 hours"}`,
          });
        }
      }

      // ─── Yield aggregation ───────────────────────────────────────────────

      // Build a map from searchQueryId to { intent } using currentQueries.
      const queryIdToMeta = new Map<string, { intent: string }>();
      for (const q of currentQueries) {
        queryIdToMeta.set(q.id, { intent: q.intent });
      }

      // Aggregate novel yield by intent.
      const novelByIntent = new Map<string, number>();
      const totalByIntent = new Map<string, number>();
      let totalNovelArticles = 0;
      let totalArticles = 0;
      const queriesWithYield = new Set<string>();
      for (const row of yieldRows) {
        const meta = queryIdToMeta.get(row.searchQueryId);
        if (!meta) continue;
        queriesWithYield.add(row.searchQueryId);
        novelByIntent.set(
          meta.intent,
          (novelByIntent.get(meta.intent) ?? 0) + row.novelArticleCount,
        );
        totalByIntent.set(
          meta.intent,
          (totalByIntent.get(meta.intent) ?? 0) + row.articleCount,
        );
        totalNovelArticles += row.novelArticleCount;
        totalArticles += row.articleCount;
      }
      const zeroYieldQueryCount = currentQueries.filter(
        (q) =>
          !queriesWithYield.has(q.id) ||
          (yieldRows.find((r) => r.searchQueryId === q.id)?.novelArticleCount ??
            0) === 0,
      ).length;
      const zeroYieldShare =
        currentQueries.length > 0
          ? Math.round((zeroYieldQueryCount / currentQueries.length) * 100)
          : 0;
      const novelRate =
        totalArticles > 0
          ? Math.round((totalNovelArticles / totalArticles) * 100)
          : 0;

      // Add novel yield KPIs.
      if (yieldRows.length > 0 || currentQueries.length > 0) {
        kpis.push(
          {
            id: "novel_articles",
            label: "Novel articles (window)",
            value: totalNovelArticles,
          },
          {
            id: "novel_rate",
            label: "Novel rate",
            value: novelRate,
            unit: "%",
          },
          {
            id: "zero_yield_query_share",
            label: "Zero-yield query share",
            value: zeroYieldShare,
            unit: "%",
            tone:
              zeroYieldShare > ZERO_YIELD_WARNING_THRESHOLD * 100
                ? "warning"
                : "positive",
          },
        );
      }

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      // When — query sets generated per day (timeSeries)
      const dailyBuckets = buildWindowDates(windowStart, now);
      for (const set of currentSets) {
        const dayKey = set.generatedAt.toISOString().slice(0, 10);
        if (dailyBuckets.has(dayKey)) {
          dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) ?? 0) + 1);
        }
      }
      sections.push({
        id: "when-sets-over-time",
        category: "when",
        title: "Query sets over time",
        widget: {
          kind: "timeSeries",
          points: Array.from(dailyBuckets.entries()).map(([ts, value]) => ({
            ts: `${ts}T00:00:00.000Z`,
            value,
          })),
          unit: "sets",
        },
      });

      // Where — language quota distribution (averaged across sets that have it)
      const languageTotals = new Map<string, number>();
      let setsWithLanguages = 0;
      for (const snap of snapshots) {
        if (
          !Array.isArray(snap.languageQuotas) ||
          snap.languageQuotas.length === 0
        )
          continue;
        setsWithLanguages += 1;
        for (const quota of snap.languageQuotas) {
          languageTotals.set(
            quota.language,
            (languageTotals.get(quota.language) ?? 0) + quota.share,
          );
        }
      }
      if (languageTotals.size > 0) {
        sections.push({
          id: "where-language-quotas",
          category: "where",
          title: "Language quota distribution",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(languageTotals.entries()).map(([label, total]) => ({
                label,
                value:
                  setsWithLanguages > 0
                    ? Math.round((total / setsWithLanguages) * 100) / 100
                    : 0,
              })),
              TOP_N,
            ),
            unit: "avg share",
          },
        });
      }

      // Who — persona coverage (from queryAttribution)
      const personaCounts = new Map<string, number>();
      for (const snap of snapshots) {
        if (!Array.isArray(snap.queryAttribution)) continue;
        for (const entry of snap.queryAttribution) {
          if (entry.persona) {
            personaCounts.set(
              entry.persona,
              (personaCounts.get(entry.persona) ?? 0) + 1,
            );
          }
        }
      }
      if (personaCounts.size > 0) {
        sections.push({
          id: "who-persona-coverage",
          category: "who",
          title: "Persona coverage",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(personaCounts.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "queries",
          },
        });
      }

      // Why — diversity axis breakdown (from latest set's diversityScore)
      const diversityAxes: Array<{ label: string; value: number }> = [];
      if (latestSnapshot?.diversityScore) {
        const ds = latestSnapshot.diversityScore;
        if (ds.lexicalDiversity !== undefined)
          diversityAxes.push({
            label: "Lexical diversity",
            value: ds.lexicalDiversity,
          });
        if (ds.intentCoverage !== undefined)
          diversityAxes.push({
            label: "Intent coverage",
            value: ds.intentCoverage,
          });
        if (ds.personaCoverage !== undefined)
          diversityAxes.push({
            label: "Persona coverage",
            value: ds.personaCoverage,
          });
        if (ds.semanticSpread !== undefined)
          diversityAxes.push({
            label: "Semantic spread",
            value: ds.semanticSpread,
          });
      }
      if (diversityAxes.length > 0) {
        sections.push({
          id: "why-diversity",
          category: "why",
          title: "Diversity axes (latest set)",
          widget: {
            kind: "categoryBar",
            bars: diversityAxes,
            unit: "score",
          },
        });
      }

      // How — intent taxonomy distribution (categoryBar over 14 intent values)
      const intentCounts = new Map<string, number>();
      for (const query of currentQueries) {
        intentCounts.set(
          query.intent,
          (intentCounts.get(query.intent) ?? 0) + 1,
        );
      }
      if (intentCounts.size > 0) {
        sections.push({
          id: "how-intent-distribution",
          category: "how",
          title: "Intent taxonomy distribution",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(intentCounts.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "queries",
          },
        });
      }

      // How — yield feedback table (top queries by novelArticleCount)
      if (yieldRows.length > 0) {
        const seenQueryIds = new Set<string>();
        const topYieldRows: YieldRow[] = [];
        for (const row of yieldRows) {
          if (!seenQueryIds.has(row.searchQueryId)) {
            seenQueryIds.add(row.searchQueryId);
            topYieldRows.push(row);
          }
          if (topYieldRows.length >= TOP_N) break;
        }
        sections.push({
          id: "how-yield-feedback",
          category: "how",
          title: "Top queries by novel articles (downstream yield)",
          insight:
            "Downstream yield of queries active in the window, ranked by novel article count.",
          widget: {
            kind: "table",
            columns: ["Query", "Novel articles", "Total articles"],
            rows: topYieldRows.map((row) => [
              row.searchQuery.text,
              row.novelArticleCount,
              row.articleCount,
            ]),
          },
        });
      }

      // How — novel yield by intent
      if (novelByIntent.size > 0) {
        sections.push({
          id: "how-yield-by-intent",
          category: "how",
          title: "Novel yield by intent",
          insight:
            "Novel articles produced by each query intent, showing which intents surface new content.",
          widget: {
            kind: "categoryBar",
            bars: bucketTopN(
              Array.from(novelByIntent.entries()).map(([label, value]) => ({
                label,
                value,
              })),
              TOP_N,
            ),
            unit: "novel articles",
          },
        });
      }

      // How — self-critique replacements over the window
      const selfCritiquePerSet = snapshots
        .map((s) => s.selfCritiqueReplacedCount ?? 0)
        .filter((v) => v > 0);
      if (selfCritiquePerSet.length > 0) {
        sections.push({
          id: "how-self-critique",
          category: "how",
          title: "Self-critique replacements",
          insight:
            "Number of queries replaced by the self-critique pass per set in the window.",
          widget: {
            kind: "categoryBar",
            bars: selfCritiquePerSet.map((value, index) => ({
              label: `Set ${index + 1}`,
              value,
            })),
            unit: "replacements",
          },
        });
      }

      return {
        agentId: "query-analysis",
        window: ctx.window,
        generatedAt: now.toISOString(),
        kpis,
        alerts,
        sections,
      };
    },
  };
}

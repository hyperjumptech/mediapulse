import type {
  InsightsPayload,
  KpiCard,
  InsightAlert,
  InsightSection,
} from "@workspace/agent-data-api-contract";
import { ZERO_COVERAGE_EXCLUDED_SECTIONS } from "@workspace/agent-data-api-contract";

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

type QuerySetRow = {
  id: string;
  tickerId: string;
  generatedAt: Date;
  strategySnapshot: unknown;
};

type QueryRow = {
  setId: string | null;
  source: string;
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
        setId: boolean;
        source: boolean;
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
  templatePack?: string;
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
    templateId?: string;
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
              select: { setId: true, source: true, intent: true },
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

      // Latest composite diversity score (from the most-recent set)
      const sortedSets = [...currentSets].sort(
        (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
      );
      const latestSet = sortedSets[0] ?? null;
      const latestSnapshot = latestSet
        ? parseStrategySnapshot(latestSet.strategySnapshot)
        : null;
      const latestDiversityScore =
        latestSnapshot?.diversityScore?.composite ?? null;

      // LLM fraction
      const totalQueries = currentQueries.length;
      const llmCount = currentQueries.filter((q) => q.source === "llm").length;
      const llmFraction =
        totalQueries > 0 ? Math.round((llmCount / totalQueries) * 100) : 0;

      // Deterministic-floor adherence
      let setsWithMinDeterministic = 0;
      for (const snap of snapshots) {
        if (snap.minDeterministicCount === undefined) continue;
        const setId = currentSets.find(
          (s) => parseStrategySnapshot(s.strategySnapshot) === snap,
        )?.id;
        const deterministic = queries.filter(
          (q) => q.setId === setId && q.source === "deterministic",
        ).length;
        if (deterministic >= snap.minDeterministicCount) {
          setsWithMinDeterministic += 1;
        }
      }
      const setsWithFloorDefined = snapshots.filter(
        (s) => s.minDeterministicCount !== undefined,
      ).length;
      const deterministicAdherence =
        setsWithFloorDefined > 0
          ? Math.round((setsWithMinDeterministic / setsWithFloorDefined) * 100)
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
        ...(latestDiversityScore !== null
          ? [
              {
                id: "diversity_score",
                label: "Diversity score (latest)",
                value: Math.round(latestDiversityScore * 100) / 100,
              } satisfies KpiCard,
            ]
          : []),
        {
          id: "llm_fraction",
          label: "LLM-sourced queries",
          value: llmFraction,
          unit: "%",
        },
        ...(deterministicAdherence !== null
          ? [
              {
                id: "deterministic_adherence",
                label: "Deterministic-floor adherence",
                value: deterministicAdherence,
                unit: "%",
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
      // Catch-all sections (e.g. quickHits) are excluded because they have no
      // dedicated upstream search intent and would produce a permanently firing alert.
      const zeroCoverageFrequency = new Map<string, number>();
      let setsWithCoverage = 0;
      for (const snap of snapshots) {
        const zeroCoverage = snap.sectionCoverage?.zeroCoverageSections;
        if (!Array.isArray(zeroCoverage)) continue;
        setsWithCoverage += 1;
        for (const section of zeroCoverage) {
          if (ZERO_COVERAGE_EXCLUDED_SECTIONS.has(section as never)) continue;
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

      // ─── Sections ────────────────────────────────────────────────────────

      const sections: InsightSection[] = [];

      // What — query source composition breakdown
      const sourceCounts = new Map<string, number>();
      for (const query of currentQueries) {
        sourceCounts.set(
          query.source,
          (sourceCounts.get(query.source) ?? 0) + 1,
        );
      }
      if (sourceCounts.size > 0) {
        const sourceTotal = Array.from(sourceCounts.values()).reduce(
          (sum, v) => sum + v,
          0,
        );
        sections.push({
          id: "what-source-composition",
          category: "what",
          title: "Query source composition",
          insight:
            "Distribution of queries by generation source across all sets in the window.",
          widget: {
            kind: "breakdown",
            slices: Array.from(sourceCounts.entries()).map(
              ([label, value]) => ({
                label,
                value,
                fraction: sourceTotal > 0 ? value / sourceTotal : 0,
              }),
            ),
          },
        });
      }

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
        if (ds.composite !== undefined)
          diversityAxes.push({ label: "Composite", value: ds.composite });
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

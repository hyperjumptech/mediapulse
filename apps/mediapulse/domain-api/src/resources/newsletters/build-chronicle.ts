import type { Prisma, prisma } from "@mediapulse/database";

import { buildSelectedSourcesWindow } from "./selected-sources-window";

/**
 * Assembles the newsletter Chronicle: a stage-by-stage record of how one
 * newsletter was generated.
 *
 * The pipeline's upstream stages (query analysis, page/data collection, article
 * analysis) run independently many times a day, so there is no single upstream
 * run tied to a newsletter. Each upstream stage therefore aggregates every run
 * that occurred within the newsletter's rolling lookback window (the same window
 * the content-generation agent draws sources from). Content generation and
 * delivery are the single runs tied to this newsletter by `newsletterId`.
 */

/** Normalized token counts surfaced on a run or stage total. */
export type ChronicleTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  embeddingTokens: number;
};

/** One provider's usage within a run (search or fetch). */
export type ChronicleProviderUsage = {
  name: string;
  /** Request count for this provider, when known. */
  calls?: number;
  /** Provider-reported credits (e.g. Serper), when known. */
  credits?: number;
};

/** Error detail surfaced on a failed run. */
export type ChronicleError = {
  code: string | null;
  category: string | null;
  message: string | null;
};

/** Aggregate status shared by stages and runs. */
export type ChronicleStatus =
  | "success"
  | "partial"
  | "failed"
  | "skipped"
  | "empty";

/** One concrete run of a stage (an upstream run, or the single downstream run). */
export type ChronicleRun = {
  id: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  status: ChronicleStatus;
  model: string | null;
  tokens: ChronicleTokenUsage | null;
  providers: ChronicleProviderUsage[];
  /** Free-form per-run outputs (counts, stopReason, etc.). */
  outputs: Record<string, unknown>;
  error: ChronicleError | null;
};

/** An upstream stage: an aggregate of every run in the window, with drill-down. */
export type ChronicleUpstreamStage = {
  kind: "upstream";
  stage:
    | "query-analysis"
    | "page-collection"
    | "data-collection"
    | "article-analysis";
  label: string;
  status: ChronicleStatus;
  windowStart: string;
  windowEnd: string;
  runCount: number;
  totals: {
    tokens: ChronicleTokenUsage;
    searchCredits: number;
    fetchByProvider: Record<string, number>;
  };
  runs: ChronicleRun[];
  /** Stage-specific rollup (e.g. classification reasons, dropped counts). */
  details: Record<string, unknown>;
};

/** A downstream stage: the single run tied to this newsletter. */
export type ChronicleDownstreamStage = {
  kind: "downstream";
  stage: "content-generation" | "delivery";
  label: string;
  status: ChronicleStatus;
  run: ChronicleRun | null;
  details: Record<string, unknown>;
};

export type ChronicleStage = ChronicleUpstreamStage | ChronicleDownstreamStage;

/** Full Chronicle payload returned by {@link buildChronicle}. */
export type ChroniclePayload = {
  newsletterId: string;
  tickerId: string;
  subject: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  overallStatus: ChronicleStatus;
  totalTokens: number;
  totalSearchCredits: number;
  upstreamRunCount: number;
  attributionNote: string;
  stages: ChronicleStage[];
};

/** Prisma collaborator surface for {@link buildChronicle}. */
export type BuildChronicleDeps = {
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findMany">;
  dataCollectionRun: Pick<typeof prisma.dataCollectionRun, "findMany">;
  pageCollectionRun: Pick<typeof prisma.pageCollectionRun, "findMany">;
  dataSourceTickerSection: Pick<
    typeof prisma.dataSourceTickerSection,
    "findMany"
  >;
  articleAnalysisRun: Pick<typeof prisma.articleAnalysisRun, "findMany">;
  contentGenerationRun: Pick<typeof prisma.contentGenerationRun, "findFirst">;
  deliveryRun: Pick<typeof prisma.deliveryRun, "findMany">;
};

const EMPTY_TOKENS: ChronicleTokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  embeddingTokens: 0,
};

const ATTRIBUTION_NOTE =
  "Query analysis, page/data collection, and article analysis run independently " +
  "many times a day. Their cards aggregate every run within this newsletter's " +
  "lookback window, not a strict 1:1 run. Content generation and delivery are the " +
  "single runs tied to this newsletter.";

/** Reads a plain object out of an unknown JSON value, or an empty object. */
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Reads a finite number out of an unknown JSON value, or `undefined`. */
const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Reads a non-empty string out of an unknown JSON value, or `undefined`. */
const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** Normalizes token counts from an unknown snapshot object. */
const readTokens = (
  snapshot: Record<string, unknown>,
): ChronicleTokenUsage => ({
  promptTokens: asNumber(snapshot.promptTokens) ?? 0,
  completionTokens: asNumber(snapshot.completionTokens) ?? 0,
  totalTokens: asNumber(snapshot.totalTokens) ?? 0,
  embeddingTokens: asNumber(snapshot.embeddingTokens) ?? 0,
});

/** Sums token usage into an accumulator (mutates and returns it). */
const addTokens = (
  into: ChronicleTokenUsage,
  add: ChronicleTokenUsage,
): ChronicleTokenUsage => {
  into.promptTokens += add.promptTokens;
  into.completionTokens += add.completionTokens;
  into.totalTokens += add.totalTokens;
  into.embeddingTokens += add.embeddingTokens;

  return into;
};

/** Aggregate stage status from the worst run outcome in the window. */
const worstStatus = (statuses: ChronicleStatus[]): ChronicleStatus => {
  if (statuses.length === 0) return "empty";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("partial")) return "partial";

  return "success";
};

/** Maps a DataCollectionRun status string to a ChronicleStatus. */
const collectionRunStatus = (status: string): ChronicleStatus => {
  if (status === "failed") return "failed";
  if (status === "partial_success") return "partial";

  return "success";
};

/** Derives startedAt/completedAt, deriving the start from duration when needed. */
const resolveTiming = (params: {
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date | null;
  durationMs?: number | null;
}): { startedAt: string | null; completedAt: string | null } => {
  const completed = params.completedAt ?? params.createdAt ?? null;
  if (params.startedAt) {
    return {
      startedAt: params.startedAt.toISOString(),
      completedAt: completed ? completed.toISOString() : null,
    };
  }
  if (
    completed &&
    params.durationMs !== null &&
    params.durationMs !== undefined
  ) {
    const derivedStart = new Date(completed.getTime() - params.durationMs);
    return {
      startedAt: derivedStart.toISOString(),
      completedAt: completed.toISOString(),
    };
  }

  return {
    startedAt: completed ? completed.toISOString() : null,
    completedAt: completed ? completed.toISOString() : null,
  };
};

/**
 * Builds the query-analysis stage from every SearchQuerySet generated in the window.
 * Token/model/timing come from the `strategySnapshot.llmUsage` / `.timing` blocks
 * the query-analysis agent writes.
 */
const buildQueryAnalysisStage = (
  sets: Array<{ id: string; generatedAt: Date; strategySnapshot: unknown }>,
  windowStartIso: string,
  windowEndIso: string,
): ChronicleUpstreamStage => {
  const totals: ChronicleTokenUsage = { ...EMPTY_TOKENS };
  let stageSearchCredits = 0;
  const runs: ChronicleRun[] = sets.map((set) => {
    const snapshot = asRecord(set.strategySnapshot);
    const usage = asRecord(snapshot.llmUsage);
    const timing = asRecord(snapshot.timing);
    const providerUsage = asRecord(snapshot.providerUsage);
    const probe = asRecord(snapshot.probe);
    const discovered = asRecord(snapshot.discovered);
    const output = asRecord(snapshot.output);
    const tokens = readTokens(usage);
    addTokens(totals, tokens);
    const durationMs =
      asNumber(timing.totalMs) ?? asNumber(timing.durationMs) ?? null;
    const startedAt = asString(timing.startedAt) ?? null;
    const completedAt =
      asString(timing.completedAt) ?? set.generatedAt.toISOString();

    // Provider usage: search-provider call counts + provider-reported credits.
    const runSearchCredits = asNumber(providerUsage.searchCredits) ?? 0;
    stageSearchCredits += runSearchCredits;
    const providers: ChronicleProviderUsage[] = [];
    const providerRows = Array.isArray(providerUsage.searchProvider)
      ? providerUsage.searchProvider
      : [];
    for (const providerRow of providerRows) {
      const row = asRecord(providerRow);
      const name = asString(row.name);
      if (name === undefined) {
        continue;
      }
      const calls = asNumber(row.calls);
      const credits = asNumber(row.credits);
      providers.push({
        name,
        ...(calls !== undefined ? { calls } : {}),
        ...(credits !== undefined ? { credits } : {}),
      });
    }

    const droppedZeroYield = Array.isArray(probe.droppedZeroYield)
      ? probe.droppedZeroYield.length
      : null;
    const discoveredCompetitors = Array.isArray(discovered.competitors)
      ? discovered.competitors.length
      : null;
    const discoveredRegulators = Array.isArray(discovered.regulators)
      ? discovered.regulators.length
      : null;

    return {
      id: set.id,
      startedAt: startedAt ?? set.generatedAt.toISOString(),
      completedAt,
      durationMs,
      status: "success",
      model: asString(usage.model) ?? null,
      tokens,
      providers,
      outputs: {
        queryCount:
          asNumber(output.queryCount) ?? asNumber(snapshot.queryCount) ?? null,
        calls: asNumber(usage.calls) ?? null,
        cacheHit: typeof usage.cacheHit === "boolean" ? usage.cacheHit : null,
        searchCredits: runSearchCredits > 0 ? runSearchCredits : null,
        discoveredCompetitors,
        discoveredRegulators,
        droppedZeroYield,
      },
      error: null,
    };
  });

  return {
    kind: "upstream",
    stage: "query-analysis",
    label: "Query Analysis",
    status: runs.length === 0 ? "empty" : "success",
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    runCount: runs.length,
    totals: {
      tokens: totals,
      searchCredits: stageSearchCredits,
      fetchByProvider: {},
    },
    runs,
    details: {},
  };
};

/**
 * Builds one collection stage (page or data) from its run rows, reading the grouped
 * `snapshot` (cost / result / timing). Collection runs no longer spend LLM tokens,
 * so no token usage is surfaced.
 */
const buildCollectionStage = (
  stage: "page-collection" | "data-collection",
  label: string,
  rows: Array<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    snapshot?: unknown;
  }>,
  windowStartIso: string,
  windowEndIso: string,
): ChronicleUpstreamStage => {
  const fetchByProvider: Record<string, number> = {};
  let searchCredits = 0;
  let savedTotal = 0;
  let excludedTotal = 0;
  const byReasonTotals: Record<string, number> = {};

  const runs: ChronicleRun[] = rows.map((row) => {
    const snapshot = asRecord(row.snapshot);
    const cost = asRecord(snapshot.cost);
    const result = asRecord(snapshot.result);
    const timing = asRecord(snapshot.timing);

    const runCredits = asNumber(cost.searchCredits) ?? 0;
    searchCredits += runCredits;

    const runFetchByProvider = asRecord(cost.fetchByProvider);
    const providers: ChronicleProviderUsage[] = [];
    for (const [name, count] of Object.entries(runFetchByProvider)) {
      const calls = asNumber(count) ?? 0;
      fetchByProvider[name] = (fetchByProvider[name] ?? 0) + calls;
      providers.push({ name, calls });
    }

    const collected = asNumber(result.saved) ?? 0;
    savedTotal += collected;
    const excluded = asNumber(result.excluded) ?? 0;
    excludedTotal += excluded;

    const byReason = asRecord(result.byReason);
    for (const [reason, count] of Object.entries(byReason)) {
      byReasonTotals[reason] =
        (byReasonTotals[reason] ?? 0) + (asNumber(count) ?? 0);
    }

    const durationMs = asNumber(timing.totalMs) ?? null;
    const stopReason = asString(timing.stopReason) ?? null;

    const runTiming = resolveTiming({
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs,
    });

    return {
      id: row.id,
      startedAt: runTiming.startedAt,
      completedAt: runTiming.completedAt,
      durationMs,
      status: collectionRunStatus(row.status),
      model: null,
      tokens: null,
      providers,
      outputs: {
        stopReason,
        collected,
        excluded,
        searchCredits: runCredits > 0 ? runCredits : null,
        ...(Object.keys(byReason).length > 0 ? { byReason } : {}),
      },
      error: null,
    };
  });

  return {
    kind: "upstream",
    stage,
    label,
    status: worstStatus(runs.map((run) => run.status)),
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    runCount: runs.length,
    totals: { tokens: { ...EMPTY_TOKENS }, searchCredits, fetchByProvider },
    runs,
    details: {
      saved: savedTotal,
      excluded: excludedTotal,
      byReason: byReasonTotals,
    },
  };
};

/**
 * Builds the article-analysis stage from the run records in the window plus the
 * per-(article, ticker) classifications for this newsletter's ticker.
 *
 * Article analysis drains a cross-ticker backlog, so the run records (tokens,
 * model, timing) are window-scoped across all tickers, while the classification
 * sample (sections, scores, reasons) is scoped to this newsletter's ticker.
 */
/**
 * Narrows a persisted `sectionScoreBreakdown` Json blob to the matched/total summary the Chronicle
 * surfaces. Returns `null` for legacy rows written before the breakdown existed or malformed values.
 *
 * @param value - The `sectionScoreBreakdown` column value (arbitrary Json or `null`).
 * @returns The matched/total tally and criteria hash, or `null` when unavailable.
 */
const readBreakdownSummary = (
  value: unknown,
): { matched: number; total: number; criteriaHash: string | null } | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.matched !== "number" || typeof record.total !== "number") {
    return null;
  }

  return {
    matched: record.matched,
    total: record.total,
    criteriaHash:
      typeof record.criteriaHash === "string" ? record.criteriaHash : null,
  };
};

const buildArticleAnalysisStage = (
  runRows: Array<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    model: string | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    scored: number;
    rejected: number;
    backlog: number;
    stopReason: string | null;
    durationMs: number | null;
  }>,
  classificationRows: Array<{
    section: string | null;
    sectionScore: number | null;
    sectionReason: string | null;
    sectionScoreBreakdown: unknown;
    analyzedAt: Date;
    dataSource: { title: string };
  }>,
  windowStartIso: string,
  windowEndIso: string,
): ChronicleUpstreamStage => {
  const classified = classificationRows.filter(
    (row) => row.section !== null,
  ).length;
  const rejected = classificationRows.length - classified;
  const sample = classificationRows.slice(0, 50).map((row) => {
    const summary = readBreakdownSummary(row.sectionScoreBreakdown);

    return {
      title: row.dataSource.title,
      section: row.section,
      score: row.sectionScore,
      reason: row.sectionReason,
      matched: summary?.matched ?? null,
      total: summary?.total ?? null,
      criteriaHash: summary?.criteriaHash ?? null,
    };
  });

  const tokenTotals: ChronicleTokenUsage = { ...EMPTY_TOKENS };
  const runs: ChronicleRun[] = runRows.map((row) => {
    const tokens: ChronicleTokenUsage = {
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      embeddingTokens: 0,
    };
    addTokens(tokenTotals, tokens);
    const timing = resolveTiming({
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs: row.durationMs,
    });

    return {
      id: row.id,
      startedAt: timing.startedAt,
      completedAt: timing.completedAt,
      durationMs: row.durationMs,
      status: collectionRunStatus(row.status),
      model: row.model,
      tokens: tokens.totalTokens > 0 ? tokens : null,
      providers: [],
      outputs: {
        scored: row.scored,
        rejected: row.rejected,
        backlog: row.backlog,
        stopReason: row.stopReason,
      },
      error: null,
    };
  });

  return {
    kind: "upstream",
    stage: "article-analysis",
    label: "Article Analysis",
    status:
      runs.length === 0
        ? classificationRows.length === 0
          ? "empty"
          : "success"
        : worstStatus(runs.map((run) => run.status)),
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    runCount: runs.length,
    totals: { tokens: tokenTotals, searchCredits: 0, fetchByProvider: {} },
    runs,
    details: {
      analyzed: classificationRows.length,
      classified,
      rejected,
      sample,
      crossTickerRuns: true,
    },
  };
};

/** Builds the single-run content-generation stage tied to this newsletter. */
const buildContentGenerationStage = (
  newsletter: {
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  },
  run: {
    id: string;
    outcome: string;
    stage: string | null;
    errorCode: string | null;
    errorCategory: string | null;
    message: string | null;
    durationMs: number | null;
    createdAt: Date;
    details: unknown;
  } | null,
): ChronicleDownstreamStage => {
  const tokens: ChronicleTokenUsage = {
    promptTokens: newsletter.promptTokens ?? 0,
    completionTokens: newsletter.completionTokens ?? 0,
    totalTokens: newsletter.totalTokens ?? 0,
    embeddingTokens: 0,
  };
  const status: ChronicleStatus =
    run === null
      ? "success"
      : run.outcome === "failed"
        ? "failed"
        : run.outcome === "skipped"
          ? "skipped"
          : "success";

  const chronicleRun: ChronicleRun | null =
    run === null
      ? null
      : {
          id: run.id,
          ...resolveTiming({
            createdAt: run.createdAt,
            durationMs: run.durationMs,
          }),
          durationMs: run.durationMs,
          status,
          model: newsletter.model,
          tokens: tokens.totalTokens > 0 ? tokens : null,
          providers: [],
          outputs: {
            stage: run.stage,
            details: run.details ?? null,
          },
          error:
            run.outcome === "failed"
              ? {
                  code: run.errorCode,
                  category: run.errorCategory,
                  message: run.message,
                }
              : null,
        };

  return {
    kind: "downstream",
    stage: "content-generation",
    label: "Content Generation",
    status,
    run: chronicleRun,
    details: { model: newsletter.model, tokens },
  };
};

/** Builds the single-run delivery stage tied to this newsletter. */
const buildDeliveryStage = (
  runs: Array<{
    id: string;
    outcome: string;
    stage: string | null;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    durationMs: number;
    runSkipReason: string | null;
    createdAt: Date;
  }>,
): ChronicleDownstreamStage => {
  const latest = runs[0];
  if (latest === undefined) {
    return {
      kind: "downstream",
      stage: "delivery",
      label: "Delivery",
      status: "skipped",
      run: null,
      details: { reason: "No delivery run for this newsletter." },
    };
  }

  const status: ChronicleStatus =
    latest.outcome === "failed"
      ? "failed"
      : latest.outcome.startsWith("skipped")
        ? "skipped"
        : latest.failureCount > 0
          ? "partial"
          : "success";

  return {
    kind: "downstream",
    stage: "delivery",
    label: "Delivery",
    status,
    run: {
      id: latest.id,
      ...resolveTiming({
        createdAt: latest.createdAt,
        durationMs: latest.durationMs,
      }),
      durationMs: latest.durationMs,
      status,
      model: null,
      tokens: null,
      providers: [{ name: "resend", calls: latest.successCount }],
      outputs: {
        stage: latest.stage,
        successCount: latest.successCount,
        failureCount: latest.failureCount,
        skippedCount: latest.skippedCount,
        runSkipReason: latest.runSkipReason,
      },
      error: null,
    },
    details: { runCount: runs.length },
  };
};

/**
 * Assembles the full Chronicle for one newsletter.
 *
 * @param newsletter - The newsletter row (id, tickerId, subject, createdAt, token fields, model).
 * @param deps - Prisma delegate collaborators.
 * @returns The assembled {@link ChroniclePayload}.
 */
export const buildChronicle = async (
  newsletter: {
    id: string;
    tickerId: string;
    subject: string;
    createdAt: Date;
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  },
  deps: BuildChronicleDeps,
): Promise<ChroniclePayload> => {
  const { windowStart, windowEnd, windowStartIso, windowEndIso } =
    buildSelectedSourcesWindow(newsletter.createdAt);
  const tickerId = newsletter.tickerId;

  const querySetArgs = {
    where: {
      tickerId,
      generatedAt: { gte: windowStart, lt: windowEnd },
    },
    orderBy: { generatedAt: "desc" as const },
    select: { id: true, generatedAt: true, strategySnapshot: true },
  } satisfies Prisma.SearchQuerySetFindManyArgs;

  const collectionRunArgs = {
    where: {
      tickerId,
      startedAt: { gte: windowStart, lt: windowEnd },
    },
    orderBy: { startedAt: "desc" as const },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      snapshot: true,
    },
  } satisfies Prisma.DataCollectionRunFindManyArgs;

  const pageCollectionRunArgs = {
    where: {
      tickerId,
      startedAt: { gte: windowStart, lt: windowEnd },
    },
    orderBy: { startedAt: "desc" as const },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      snapshot: true,
    },
  } satisfies Prisma.PageCollectionRunFindManyArgs;

  const analysisArgs = {
    where: {
      tickerId,
      analyzedAt: { gte: windowStart, lt: windowEnd },
    },
    orderBy: { analyzedAt: "desc" as const },
    select: {
      section: true,
      sectionScore: true,
      sectionReason: true,
      sectionScoreBreakdown: true,
      analyzedAt: true,
      dataSource: { select: { title: true } },
    },
  } satisfies Prisma.DataSourceTickerSectionFindManyArgs;

  // Article-analysis runs drain a cross-ticker backlog, so they are scoped to the
  // window only (not this newsletter's ticker).
  const articleAnalysisRunArgs = {
    where: {
      startedAt: { gte: windowStart, lt: windowEnd },
    },
    orderBy: { startedAt: "desc" as const },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      scored: true,
      rejected: true,
      backlog: true,
      stopReason: true,
      durationMs: true,
    },
  } satisfies Prisma.ArticleAnalysisRunFindManyArgs;

  const contentRunArgs = {
    where: { newsletterId: newsletter.id },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      outcome: true,
      stage: true,
      errorCode: true,
      errorCategory: true,
      message: true,
      durationMs: true,
      createdAt: true,
      details: true,
    },
  } satisfies Prisma.ContentGenerationRunFindFirstArgs;

  const deliveryRunArgs = {
    where: { newsletterId: newsletter.id },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      outcome: true,
      stage: true,
      successCount: true,
      failureCount: true,
      skippedCount: true,
      durationMs: true,
      runSkipReason: true,
      createdAt: true,
    },
  } satisfies Prisma.DeliveryRunFindManyArgs;

  const [
    querySets,
    collectionRuns,
    pageRuns,
    analysisRows,
    analysisRuns,
    contentRun,
    deliveryRuns,
  ] = await Promise.all([
    deps.searchQuerySet.findMany(querySetArgs),
    deps.dataCollectionRun.findMany(collectionRunArgs),
    deps.pageCollectionRun.findMany(pageCollectionRunArgs),
    deps.dataSourceTickerSection.findMany(analysisArgs),
    deps.articleAnalysisRun.findMany(articleAnalysisRunArgs),
    deps.contentGenerationRun.findFirst(contentRunArgs),
    deps.deliveryRun.findMany(deliveryRunArgs),
  ]);

  // Page-collection owns its own run table, but it still writes a DataCollectionRun
  // row (the FK parent for its per-URL outcomes), so exclude those from the
  // data-collection card and fold them into the page card (deduped by id).
  const agentIdOf = (row: { snapshot?: unknown }): string | undefined =>
    asString(asRecord(row.snapshot).agentId);
  const legacyPageRuns = collectionRuns.filter(
    (row) => agentIdOf(row) === "page-collection",
  );
  const dataCollectionRuns = collectionRuns.filter(
    (row) => agentIdOf(row) !== "page-collection",
  );
  const pageRunIds = new Set(pageRuns.map((row) => row.id));
  const pageCollectionRuns = [
    ...pageRuns,
    ...legacyPageRuns.filter((row) => !pageRunIds.has(row.id)),
  ];

  const queryAnalysis = buildQueryAnalysisStage(
    querySets,
    windowStartIso,
    windowEndIso,
  );
  const pageCollection = buildCollectionStage(
    "page-collection",
    "Page Collection",
    pageCollectionRuns,
    windowStartIso,
    windowEndIso,
  );
  const dataCollection = buildCollectionStage(
    "data-collection",
    "Data Collection",
    dataCollectionRuns,
    windowStartIso,
    windowEndIso,
  );
  const articleAnalysis = buildArticleAnalysisStage(
    analysisRuns,
    analysisRows,
    windowStartIso,
    windowEndIso,
  );
  const contentGeneration = buildContentGenerationStage(newsletter, contentRun);
  const delivery = buildDeliveryStage(deliveryRuns);

  const stages: ChronicleStage[] = [
    queryAnalysis,
    pageCollection,
    dataCollection,
    articleAnalysis,
    contentGeneration,
    delivery,
  ];

  const upstreamStages: ChronicleUpstreamStage[] = [
    queryAnalysis,
    pageCollection,
    dataCollection,
    articleAnalysis,
  ];
  // Content-generation tokens live on the newsletter itself, so they count even
  // when no content-generation diagnostic run row exists. Delivery has no tokens.
  const totalTokens =
    upstreamStages.reduce(
      (sum, stage) => sum + stage.totals.tokens.totalTokens,
      0,
    ) + (newsletter.totalTokens ?? 0);
  const totalSearchCredits = upstreamStages.reduce(
    (sum, stage) => sum + stage.totals.searchCredits,
    0,
  );
  const upstreamRunCount = upstreamStages.reduce(
    (sum, stage) => sum + stage.runCount,
    0,
  );
  const overallStatus: ChronicleStatus =
    delivery.status === "failed" || contentGeneration.status === "failed"
      ? "failed"
      : delivery.status === "partial"
        ? "partial"
        : delivery.status;

  return {
    newsletterId: newsletter.id,
    tickerId,
    subject: newsletter.subject,
    generatedAt: newsletter.createdAt.toISOString(),
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    overallStatus,
    totalTokens,
    totalSearchCredits,
    upstreamRunCount,
    attributionNote: ATTRIBUTION_NOTE,
    stages,
  };
};

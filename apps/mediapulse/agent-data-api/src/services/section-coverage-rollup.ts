import { prisma, type Prisma } from "@mediapulse/database";
import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";
import type { SectionCoverageVersionRow } from "@workspace/agent-data-api-contract";

type SectionCoverageRollupDb = {
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findMany">;
  contentGenerationRun: Pick<typeof prisma.contentGenerationRun, "findMany">;
};

const defaultDb: SectionCoverageRollupDb = {
  searchQuerySet: prisma.searchQuerySet,
  contentGenerationRun: prisma.contentGenerationRun,
};

type SectionCountsAccumulator = Map<string, number>;

type VersionAccumulator = {
  coverageSamples: SectionCountsAccumulator[];
  fillSamples: SectionCountsAccumulator[];
};

/**
 * Safely extracts the sectionCoverage block from a QA strategySnapshot JSON value.
 */
const extractQaCoverage = (
  snapshot: unknown,
): {
  contractVersion?: string;
  bySection: Record<string, { count: number }>;
} | null => {
  if (snapshot === null || typeof snapshot !== "object") {
    return null;
  }
  const sectionCoverage = (snapshot as Record<string, unknown>).sectionCoverage;
  if (sectionCoverage === null || typeof sectionCoverage !== "object") {
    return null;
  }
  const bySection = (sectionCoverage as Record<string, unknown>).bySection;
  if (bySection === null || typeof bySection !== "object") {
    return null;
  }
  const contractVersion = (sectionCoverage as Record<string, unknown>)
    .contractVersion;
  return {
    bySection: bySection as Record<string, { count: number }>,
    ...(typeof contractVersion === "string" ? { contractVersion } : {}),
  };
};

/**
 * Safely extracts the sectionFill block from a CG run details JSON value.
 */
const extractCgFill = (
  details: unknown,
): {
  contractVersion?: string;
  bySection: Record<string, { citedBullets: number }>;
} | null => {
  if (details === null || typeof details !== "object") {
    return null;
  }
  const sectionFill = (details as Record<string, unknown>).sectionFill;
  if (sectionFill === null || typeof sectionFill !== "object") {
    return null;
  }
  const bySection = (sectionFill as Record<string, unknown>).bySection;
  if (bySection === null || typeof bySection !== "object") {
    return null;
  }
  const contractVersion = (sectionFill as Record<string, unknown>)
    .contractVersion;
  return {
    bySection: bySection as Record<string, { citedBullets: number }>,
    ...(typeof contractVersion === "string" ? { contractVersion } : {}),
  };
};

/**
 * Converts a version accumulator to the final rollup row.
 */
const finalizeVersionRow = (
  contractVersion: string | null,
  accumulator: VersionAccumulator,
): SectionCoverageVersionRow => {
  const coverageRunCount = accumulator.coverageSamples.length;
  const fillRunCount = accumulator.fillSamples.length;

  const bySection: Record<
    string,
    { avgCoverage: number; avgFill: number | null }
  > = {};
  for (const sectionId of NEWSLETTER_SECTION_IDS) {
    const totalCoverage = accumulator.coverageSamples.reduce(
      (sum, sample) => sum + (sample.get(sectionId) ?? 0),
      0,
    );
    const avgCoverage =
      coverageRunCount > 0 ? totalCoverage / coverageRunCount : 0;

    let avgFill: number | null = null;
    if (fillRunCount > 0) {
      const totalFill = accumulator.fillSamples.reduce(
        (sum, sample) => sum + (sample.get(sectionId) ?? 0),
        0,
      );
      avgFill = totalFill / fillRunCount;
    }

    bySection[sectionId] = { avgCoverage, avgFill };
  }

  return { contractVersion, coverageRunCount, fillRunCount, bySection };
};

/**
 * Returns windowed per-section average coverage and fill grouped by contract version.
 *
 * Coverage comes from `SearchQuerySet.strategySnapshot.sectionCoverage`, fill from
 * `ContentGenerationRun.details.sectionFill`. Both are tagged with `contractVersion`
 * when an Agent Contract was attached to the pipeline step; runs without a contract
 * are grouped under `contractVersion: null`.
 *
 * @param params - Ticker id and rolling window in calendar days.
 * @param db - Optional injected DB delegates for testing.
 * @returns Per-version rollup rows, sorted by contract version (nulls last).
 */
export const getSectionCoverageRollup = async (
  params: { tickerId: string; windowDays: number },
  db: SectionCoverageRollupDb = defaultDb,
): Promise<SectionCoverageVersionRow[]> => {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - params.windowDays);
  windowStart.setUTCHours(0, 0, 0, 0);

  const [qaRows, cgRows] = await Promise.all([
    db.searchQuerySet.findMany({
      where: {
        tickerId: params.tickerId,
        createdAt: { gte: windowStart },
      },
      select: { strategySnapshot: true },
      orderBy: { createdAt: "desc" },
    } satisfies Prisma.SearchQuerySetFindManyArgs),
    db.contentGenerationRun.findMany({
      where: {
        tickerId: params.tickerId,
        outcome: "success",
        createdAt: { gte: windowStart },
      },
      select: { details: true },
      orderBy: { createdAt: "desc" },
    } satisfies Prisma.ContentGenerationRunFindManyArgs),
  ]);

  const versionMap = new Map<string | null, VersionAccumulator>();

  const getOrCreate = (version: string | null): VersionAccumulator => {
    const existing = versionMap.get(version);
    if (existing !== undefined) {
      return existing;
    }
    const fresh: VersionAccumulator = { coverageSamples: [], fillSamples: [] };
    versionMap.set(version, fresh);

    return fresh;
  };

  for (const row of qaRows) {
    const coverage = extractQaCoverage(row.strategySnapshot);
    if (coverage === null) {
      continue;
    }
    const version = coverage.contractVersion ?? null;
    const accumulator = getOrCreate(version);
    const sample = new Map<string, number>();
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      const entry = coverage.bySection[sectionId];
      const count =
        entry !== undefined && typeof entry.count === "number"
          ? entry.count
          : 0;
      sample.set(sectionId, count);
    }
    accumulator.coverageSamples.push(sample);
  }

  for (const row of cgRows) {
    const fill = extractCgFill(row.details);
    if (fill === null) {
      continue;
    }
    const version = fill.contractVersion ?? null;
    const accumulator = getOrCreate(version);
    const sample = new Map<string, number>();
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      const entry = fill.bySection[sectionId];
      const citedBullets =
        entry !== undefined && typeof entry.citedBullets === "number"
          ? entry.citedBullets
          : 0;
      sample.set(sectionId, citedBullets);
    }
    accumulator.fillSamples.push(sample);
  }

  const rows = [...versionMap.entries()]
    .sort(([versionA], [versionB]) => {
      if (versionA === null && versionB === null) {
        return 0;
      }
      if (versionA === null) {
        return 1;
      }
      if (versionB === null) {
        return -1;
      }

      return versionA.localeCompare(versionB);
    })
    .map(([version, accumulator]) => finalizeVersionRow(version, accumulator));

  return rows;
};

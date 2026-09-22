import {
  formatDuration,
  formatRejectionRate,
  listInclude,
  type KnowledgeExtractionRunRow,
} from "./list-mapper";

export const detailInclude = listInclude;

export type DetailItem = {
  id: string;
  title: string;
  status: string;
  tickerSymbol: string;
  tickerId: string | null;
  header: {
    consideredLabel: string;
    entitiesLabel: string;
    mentionsLabel: string;
    rejectionLabel: string;
    rejectionVariant: "success" | "warning" | "danger";
    durationLabel: string;
    perArticleLabel: string;
  };
  startedAt: string;
  completedAt: string | null;
  watermarkAt: string | null;
  agentVersion: string;
  scheduleExecutionId: string | null;
  stopReason: string;
  counters: {
    label: string;
    value: string;
  }[];
};

/** Above this share of refused claims, the prompt is the problem rather than the corpus. */
export const REJECTION_WARNING_RATIO = 0.1;
export const REJECTION_DANGER_RATIO = 0.25;

const rejectionVariant = (
  mentionsWritten: number,
  refused: number,
): DetailItem["header"]["rejectionVariant"] => {
  const proposed = mentionsWritten + refused;
  if (proposed <= 0) {
    return "success";
  }
  const ratio = refused / proposed;
  if (ratio >= REJECTION_DANGER_RATIO) {
    return "danger";
  }
  if (ratio >= REJECTION_WARNING_RATIO) {
    return "warning";
  }

  return "success";
};

/**
 * How long each article took, which is what decides whether a batch fits the job timeout.
 *
 * @param durationMs - Run duration.
 * @param considered - Articles read.
 */
export const formatPerArticle = (
  durationMs: number | null,
  considered: number,
): string => {
  if (durationMs === null || considered <= 0) {
    return "—";
  }

  return `${(durationMs / considered / 1000).toFixed(1)} s per article`;
};

/**
 * Shapes one extraction run for its detail page.
 *
 * @param row - Run with its issuer.
 */
export function mapRowToDetailItem(row: KnowledgeExtractionRunRow): DetailItem {
  const refused = row.rejectedSpanNotInText + row.rejectedNameNotInText;

  return {
    id: row.id,
    title: `${row.ticker?.symbol ?? "Every issuer"} · ${row.startedAt.toISOString()}`,
    status: row.status,
    tickerSymbol: row.ticker?.symbol ?? "—",
    tickerId: row.tickerId,
    header: {
      consideredLabel: String(row.considered),
      entitiesLabel: String(row.entitiesCreated),
      mentionsLabel: String(row.mentionsWritten),
      rejectionLabel: formatRejectionRate(
        row.mentionsWritten,
        row.rejectedSpanNotInText,
        row.rejectedNameNotInText,
      ),
      rejectionVariant: rejectionVariant(row.mentionsWritten, refused),
      durationLabel: formatDuration(row.durationMs),
      perArticleLabel: formatPerArticle(row.durationMs, row.considered),
    },
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    watermarkAt: row.watermarkAt ? row.watermarkAt.toISOString() : null,
    agentVersion: row.agentVersion ?? "—",
    scheduleExecutionId: row.scheduleExecutionId,
    // An empty reason is the normal case for a clean run, and saying so beats a blank cell.
    stopReason: row.stopReason ?? "Nothing stopped this run early.",
    counters: [
      { label: "Articles read", value: String(row.considered) },
      {
        label: "Skipped, named nothing",
        value: String(row.skippedNoCandidates),
      },
      { label: "Entities created", value: String(row.entitiesCreated) },
      { label: "Mentions written", value: String(row.mentionsWritten) },
      { label: "Relations opened", value: String(row.relationsOpened) },
      { label: "Relations confirmed", value: String(row.relationsConfirmed) },
      { label: "Relation kinds invented", value: String(row.kindsCreated) },
      {
        label: "Refused, span not in the article",
        value: String(row.rejectedSpanNotInText),
      },
      {
        label: "Refused, party not named",
        value: String(row.rejectedNameNotInText),
      },
      {
        label: "Dropped, a person not a party",
        value: String(row.rejectedPerson),
      },
    ],
  };
}

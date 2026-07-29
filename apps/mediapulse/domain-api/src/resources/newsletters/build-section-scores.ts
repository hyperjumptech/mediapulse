import { MEDIAPULSE_NEWSLETTER_SECTIONS } from "@workspace/agent-data-api-contract";

/** Badge variant for a section-fit score, banded green / orange / red. */
export type SectionScoreVariant = "success" | "warning" | "destructive";

/** One section's fit score and per-rule reasoning, as rendered in the Score column. */
export type SectionScorePayload = {
  section: string;
  sectionLabel: string;
  score: number;
  scoreLabel: string;
  scoreLine: string;
  scoreVariant: SectionScoreVariant;
  isSelected: boolean;
  reason: string;
};

type StoredCriterion = {
  id: string;
  section: string;
  matched: boolean;
  note: string;
};

type StoredSection = {
  section: string;
  matched: number;
  total: number;
};

const SECTION_LABEL_BY_ID = new Map<string, string>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [section.id, section.label]),
);

const SECTION_ORDER_BY_ID = new Map<string, number>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section, index) => [section.id, index]),
);

/** Bands a 0–1 section-fit score into a green / orange / red variant. */
export const sectionScoreVariantFor = (score: number): SectionScoreVariant => {
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";

  return "destructive";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseSections = (raw: unknown): StoredSection[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { section, matched, total } = entry;
    if (
      typeof section !== "string" ||
      typeof matched !== "number" ||
      typeof total !== "number"
    ) {
      return [];
    }

    return [{ section, matched, total }];
  });
};

const parseCriteria = (raw: unknown): StoredCriterion[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { id, section, matched, note } = entry;
    if (
      typeof id !== "string" ||
      typeof section !== "string" ||
      typeof matched !== "boolean"
    ) {
      return [];
    }

    return [
      { id, section, matched, note: typeof note === "string" ? note : "" },
    ];
  });
};

const composeReason = (
  matched: number,
  total: number,
  criteria: StoredCriterion[],
): string => {
  if (matched === 0) return "No rules matched.";
  const tally = `Matched ${matched} of ${total}`;
  if (criteria.length === 0) return tally;

  const lines = [tally];
  for (const criterion of criteria.filter((entry) => entry.matched)) {
    lines.push(`• ${criterion.id}`);
  }

  const missed = criteria.filter((criterion) => !criterion.matched);
  if (missed.length > 0) {
    lines.push("", `Missed ${missed.length}`);
    for (const criterion of missed) {
      lines.push(
        criterion.note
          ? `• ${criterion.id}: ${criterion.note}`
          : `• ${criterion.id}`,
      );
    }
  }

  return lines.join("\n");
};

/**
 * Expands a stored `sectionScoreBreakdown` into one entry per newsletter section, in canonical
 * display order, each carrying its fit score and the per-rule reasoning behind it.
 *
 * Entries are ordered by fit score, best first, so the strongest candidate leads regardless of which
 * section won; ties fall back to canonical display order.
 *
 * - Important: the winning section reports `winnerScore` rather than its matched fraction, because
 *   the stored score may have been capped by the issuer-relevance rule. Rows analysed before the
 *   breakdown carried every section's rules still list each section's tally, with per-rule detail
 *   available only for the winner.
 *
 * @param rawBreakdown - The `sectionScoreBreakdown` JSON column, of unknown shape.
 * @param winnerSection - The section the article was assigned to, or `null` when rejected.
 * @param winnerScore - The persisted fit score for the winning section, or `null` when rejected.
 * @returns One entry per scored section, or an empty array when the breakdown is unusable.
 */
export const buildSectionScores = (
  rawBreakdown: unknown,
  winnerSection: string | null,
  winnerScore: number | null,
): SectionScorePayload[] => {
  if (!isRecord(rawBreakdown)) return [];
  const sections = parseSections(rawBreakdown["sections"]);
  if (sections.length === 0) return [];
  const criteria = parseCriteria(rawBreakdown["criteria"]);

  return sections
    .map((tally) => {
      const isWinner =
        winnerSection !== null && tally.section === winnerSection;
      const fraction = tally.total > 0 ? tally.matched / tally.total : 0;
      const score = isWinner && winnerScore !== null ? winnerScore : fraction;
      const label = SECTION_LABEL_BY_ID.get(tally.section) ?? tally.section;
      const sectionCriteria = criteria.filter(
        (criterion) => criterion.section === tally.section,
      );

      return {
        section: tally.section,
        sectionLabel: label,
        score,
        scoreLabel: score.toFixed(2),
        scoreLine: `${score.toFixed(2)} - ${label}`,
        scoreVariant: sectionScoreVariantFor(score),
        isSelected: isWinner,
        reason: composeReason(tally.matched, tally.total, sectionCriteria),
      } satisfies SectionScorePayload;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      return (
        (SECTION_ORDER_BY_ID.get(left.section) ??
          MEDIAPULSE_NEWSLETTER_SECTIONS.length) -
        (SECTION_ORDER_BY_ID.get(right.section) ??
          MEDIAPULSE_NEWSLETTER_SECTIONS.length)
      );
    });
};

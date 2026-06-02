import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";

export type FocusDecision =
  | { kind: "keep" }
  | { kind: "flag"; reason: "issuer_only" }
  | { kind: "drop"; reason: "issuer_only" };

export type FocusReport = {
  bulletIndex: number;
  mentionsIssuer: boolean;
  mentionsCompetitor: boolean;
  decision: FocusDecision;
};

export type FocusSummary = {
  evaluated: number;
  dropped: number;
  flagged: number;
  competitorCount: number;
};

export type FocusPolicy = "warn" | "flag" | "drop";

export type CompetitorRef = { name: string; aliases?: string[] };

export type EnforceCompetitiveFocusOptions = {
  competitors: ReadonlyArray<CompetitorRef>;
  issuerAliases: ReadonlyArray<string>;
  policy: FocusPolicy;
  /**
   * When true, the gate may drop all bullets and let require-citation pruning
   * remove the empty section. When false, the gate preserves at least
   * SECTION_MIN_COMPETITIVE_LANDSCAPE bullets by downgrading drops to flags.
   */
  requireCitationEnabled?: boolean;
};

export type EnforceCompetitiveFocusResult = {
  structure: IndustryNewsletterStructure;
  reports: FocusReport[];
  summary: FocusSummary;
};

const SECTION_MIN_COMPETITIVE_LANDSCAPE = 2;

const FLAG_MARKER = "[ISSUER-ONLY] ";

/**
 * Case-insensitive, word-boundary substring check.
 *
 * Returns true when `text` contains any entry from `names` as a whole
 * word or phrase (not embedded inside a longer word).
 *
 * @param text - Bullet text to scan.
 * @param names - Candidate names/aliases to look for.
 */
export const mentionsAny = (
  text: string,
  names: ReadonlyArray<string>,
): boolean => {
  const lowerText = text.toLowerCase();
  return names.some((name) => {
    const lowerName = name.trim().toLowerCase();
    if (lowerName.length === 0) return false;
    let searchStart = 0;
    while (searchStart < lowerText.length) {
      const index = lowerText.indexOf(lowerName, searchStart);
      if (index === -1) return false;
      const charBefore = index > 0 ? lowerText[index - 1] : null;
      const charAfter =
        index + lowerName.length < lowerText.length
          ? lowerText[index + lowerName.length]
          : null;
      const beforeOk = charBefore == null || /\W/.test(charBefore);
      const afterOk = charAfter == null || /\W/.test(charAfter);
      if (beforeOk && afterOk) return true;
      searchStart = index + 1;
    }
    return false;
  });
};

/**
 * Walks `competitiveLandscape.bullets`, classifying each bullet as issuer-only,
 * competitor-grounded, or generic, then applies `policy` to issuer-only bullets.
 *
 * A bullet is issuer-only when it mentions the issuer (by any alias) but mentions
 * no competitor name or alias. Competitor-grounded bullets that mention both the
 * issuer and a rival (e.g. "Bank Mandiri undercut BBCA on rates") are kept.
 *
 * No-op when `competitors` is empty — never strips the section when the KG is sparse.
 *
 * Floor/prune handoff: when `requireCitationEnabled` is false the gate keeps at
 * least `SECTION_MIN_COMPETITIVE_LANDSCAPE` bullets by downgrading excess drops to
 * flags. When `requireCitationEnabled` is true, drops may reduce the section to zero
 * and require-citation pruning removes it cleanly.
 *
 * @param structure - Post-polish structured newsletter (before URL attach and grounding).
 * @param opts - Competitors, issuer aliases, policy, and require-citation flag.
 */
export function enforceCompetitiveFocus(
  structure: IndustryNewsletterStructure,
  opts: EnforceCompetitiveFocusOptions,
): EnforceCompetitiveFocusResult {
  const {
    competitors,
    issuerAliases,
    policy,
    requireCitationEnabled = true,
  } = opts;

  if (competitors.length === 0) {
    return {
      structure,
      reports: [],
      summary: { evaluated: 0, dropped: 0, flagged: 0, competitorCount: 0 },
    };
  }

  const competitorNames: string[] = competitors.flatMap((competitor) => [
    competitor.name,
    ...(competitor.aliases ?? []),
  ]);

  const bullets = structure.competitiveLandscape.bullets;
  const reports: FocusReport[] = [];
  const issuerOnlyIndices: number[] = [];

  for (let bulletIndex = 0; bulletIndex < bullets.length; bulletIndex++) {
    const bullet = bullets[bulletIndex]!;
    const mentionsIssuer = mentionsAny(bullet.text, issuerAliases as string[]);
    const mentionsCompetitor = mentionsAny(bullet.text, competitorNames);
    const isIssuerOnly = mentionsIssuer && !mentionsCompetitor;

    if (isIssuerOnly) {
      issuerOnlyIndices.push(bulletIndex);
    }

    reports.push({
      bulletIndex,
      mentionsIssuer,
      mentionsCompetitor,
      decision: { kind: "keep" },
    });
  }

  if (issuerOnlyIndices.length === 0 || policy === "warn") {
    return {
      structure,
      reports,
      summary: {
        evaluated: issuerOnlyIndices.length,
        dropped: 0,
        flagged: 0,
        competitorCount: competitors.length,
      },
    };
  }

  let dropSet = new Set<number>();
  let flagSet = new Set<number>();

  if (policy === "flag") {
    flagSet = new Set(issuerOnlyIndices);
  } else {
    // policy === "drop"
    const maxDropCount = requireCitationEnabled
      ? issuerOnlyIndices.length
      : Math.max(0, bullets.length - SECTION_MIN_COMPETITIVE_LANDSCAPE);
    const actualDropCount = Math.min(issuerOnlyIndices.length, maxDropCount);
    dropSet = new Set(issuerOnlyIndices.slice(0, actualDropCount));
    flagSet = new Set(issuerOnlyIndices.slice(actualDropCount));
  }

  for (const bulletIndex of dropSet) {
    reports[bulletIndex]!.decision = { kind: "drop", reason: "issuer_only" };
  }
  for (const bulletIndex of flagSet) {
    reports[bulletIndex]!.decision = { kind: "flag", reason: "issuer_only" };
  }

  const newBullets = bullets
    .map((bullet, bulletIndex) => {
      if (dropSet.has(bulletIndex)) return null;
      if (flagSet.has(bulletIndex)) {
        return { ...bullet, text: `${FLAG_MARKER}${bullet.text}` };
      }
      return bullet;
    })
    .filter(
      (bullet): bullet is NonNullable<(typeof bullets)[number]> =>
        bullet !== null,
    );

  const newStructure: IndustryNewsletterStructure = {
    ...structure,
    competitiveLandscape: {
      ...structure.competitiveLandscape,
      bullets: newBullets,
    },
  };

  const dropped = dropSet.size;
  const flagged = flagSet.size;

  return {
    structure: newStructure,
    reports,
    summary: {
      evaluated: issuerOnlyIndices.length,
      dropped,
      flagged,
      competitorCount: competitors.length,
    },
  };
}

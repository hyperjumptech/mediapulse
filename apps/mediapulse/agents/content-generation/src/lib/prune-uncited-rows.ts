import type {
  IndustryBulletResolved,
  IndustryDisruptorsOrTechResolved,
  IndustryNewsletterResolved,
  IndustryQuickHitResolved,
} from "../industry-newsletter-urls.js";

/** Why a row was removed by the prune pass. */
export type PrunedRowReason = "uncited" | "duplicate_article";

/** Per-section outcome for a single prune pass. */
export type PruneReport = {
  sectionKey: string;
  removedBullets: number;
  removedForDuplicate: number;
  sectionRemoved: boolean;
};

/** Rolled-up counters for the run-details surface. */
export type PruneSummary = {
  sectionsRemoved: number;
  bulletsRemovedUncited: number;
  bulletsRemovedDuplicate: number;
  sectionsKept: number;
};

export type PruneSectionKey =
  | "industryPulse"
  | "competitiveLandscape"
  | "dealsAndMovements"
  | "regulatoryPolicyWatch"
  | "disruptorsOrTech"
  | "quickHits";

export type PruneOptions = {
  /** Which body sections to apply pruning to. Defaults to all five. */
  sections?: ReadonlyArray<PruneSectionKey>;
  /** When true, two rows citing the same article URL in the same scope are deduped. */
  dedupeArticlesWithinSection?: boolean;
  /**
   * Controls whether dedup tracks seen URLs per-section ('section') or across
   * the entire newsletter ('newsletter'). Defaults to 'section'.
   */
  dedupeScope?: "section" | "newsletter";
};

export type PruneNewsletterResult = {
  resolved: IndustryNewsletterResolved;
  reports: PruneReport[];
  summary: PruneSummary;
};

const ALL_SECTIONS: ReadonlyArray<PruneSectionKey> = [
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
  "quickHits",
];

/** A row is cited iff `url` resolved to a non-empty string during `attachIndustryNewsletterSourceUrls`. */
const isRowCited = (row: { url?: string }): boolean => row.url !== undefined;

function pruneRows<T extends { url?: string }>(
  rows: ReadonlyArray<T>,
  seenUrls: Set<string>,
  dedupeEnabled: boolean,
): { kept: T[]; removedUncited: number; removedDuplicate: number } {
  let removedUncited = 0;
  let removedDuplicate = 0;
  const kept: T[] = [];

  for (const row of rows) {
    if (!isRowCited(row)) {
      removedUncited++;
      continue;
    }
    if (dedupeEnabled) {
      const url = row.url!;
      if (seenUrls.has(url)) {
        removedDuplicate++;
        continue;
      }
      seenUrls.add(url);
    }
    kept.push(row);
  }

  return { kept, removedUncited, removedDuplicate };
}

/**
 * Removes uncited and duplicate-article rows from a resolved newsletter.
 *
 * Operates on the resolved structure (URLs already attached) so "cited" is
 * a direct `url !== undefined` check. A section that drops to zero cited rows
 * is set to `undefined`.
 *
 * @param resolved - Resolved newsletter (post URL attachment).
 * @param opts - Which sections to prune and dedup settings.
 * @returns Pruned resolved structure, per-section reports, and rolled-up summary.
 */
export function pruneNewsletterToCitedRows(
  resolved: IndustryNewsletterResolved,
  opts: PruneOptions = {},
): PruneNewsletterResult {
  const configuredSections = opts.sections ?? ALL_SECTIONS;
  const dedupeEnabled = opts.dedupeArticlesWithinSection ?? true;
  const dedupeScope = opts.dedupeScope ?? "section";

  const reports: PruneReport[] = [];
  let sectionsRemoved = 0;
  let bulletsRemovedUncited = 0;
  let bulletsRemovedDuplicate = 0;
  let sectionsKept = 0;

  // Shared URL set used when dedupeScope === 'newsletter'.
  const newsletterSeenUrls = new Set<string>();

  const getSeenUrls = (): Set<string> =>
    dedupeScope === "newsletter" ? newsletterSeenUrls : new Set<string>();

  const shouldPrune = (key: PruneSectionKey): boolean =>
    (configuredSections as ReadonlyArray<string>).includes(key);

  // --- industryPulse ---
  let industryPulse = resolved.industryPulse;
  if (shouldPrune("industryPulse") && industryPulse !== undefined) {
    if (industryPulse.url === undefined) {
      industryPulse = undefined;
      sectionsRemoved++;
      reports.push({
        sectionKey: "industryPulse",
        removedBullets: 0,
        removedForDuplicate: 0,
        sectionRemoved: true,
      });
    } else {
      sectionsKept++;
    }
  }

  // --- competitiveLandscape ---
  let competitiveLandscape = resolved.competitiveLandscape;
  if (
    shouldPrune("competitiveLandscape") &&
    competitiveLandscape !== undefined
  ) {
    const { kept, removedUncited, removedDuplicate } = pruneRows(
      competitiveLandscape.bullets,
      getSeenUrls(),
      dedupeEnabled,
    );
    bulletsRemovedUncited += removedUncited;
    bulletsRemovedDuplicate += removedDuplicate;
    const sectionRemoved = kept.length === 0;
    reports.push({
      sectionKey: "competitiveLandscape",
      removedBullets: removedUncited,
      removedForDuplicate: removedDuplicate,
      sectionRemoved,
    });
    if (sectionRemoved) {
      sectionsRemoved++;
      competitiveLandscape = undefined;
    } else {
      sectionsKept++;
      competitiveLandscape = { ...competitiveLandscape, bullets: kept };
    }
  }

  // --- dealsAndMovements ---
  let dealsAndMovements = resolved.dealsAndMovements;
  if (shouldPrune("dealsAndMovements") && dealsAndMovements !== undefined) {
    const { kept, removedUncited, removedDuplicate } = pruneRows(
      dealsAndMovements.bullets,
      getSeenUrls(),
      dedupeEnabled,
    );
    bulletsRemovedUncited += removedUncited;
    bulletsRemovedDuplicate += removedDuplicate;
    const sectionRemoved = kept.length === 0;
    reports.push({
      sectionKey: "dealsAndMovements",
      removedBullets: removedUncited,
      removedForDuplicate: removedDuplicate,
      sectionRemoved,
    });
    if (sectionRemoved) {
      sectionsRemoved++;
      dealsAndMovements = undefined;
    } else {
      sectionsKept++;
      dealsAndMovements = { ...dealsAndMovements, bullets: kept };
    }
  }

  // --- regulatoryPolicyWatch ---
  let regulatoryPolicyWatch = resolved.regulatoryPolicyWatch;
  if (
    shouldPrune("regulatoryPolicyWatch") &&
    regulatoryPolicyWatch !== undefined
  ) {
    const { kept, removedUncited, removedDuplicate } = pruneRows(
      regulatoryPolicyWatch.bullets,
      getSeenUrls(),
      dedupeEnabled,
    );
    bulletsRemovedUncited += removedUncited;
    bulletsRemovedDuplicate += removedDuplicate;
    const sectionRemoved = kept.length === 0;
    reports.push({
      sectionKey: "regulatoryPolicyWatch",
      removedBullets: removedUncited,
      removedForDuplicate: removedDuplicate,
      sectionRemoved,
    });
    if (sectionRemoved) {
      sectionsRemoved++;
      regulatoryPolicyWatch = undefined;
    } else {
      sectionsKept++;
      regulatoryPolicyWatch = { ...regulatoryPolicyWatch, bullets: kept };
    }
  }

  // --- disruptorsOrTech ---
  let disruptorsOrTech: IndustryDisruptorsOrTechResolved | undefined =
    resolved.disruptorsOrTech;
  if (shouldPrune("disruptorsOrTech") && disruptorsOrTech !== undefined) {
    if (disruptorsOrTech.format === "prose") {
      // Prose variant has no citation mechanism — always removed as uncited.
      disruptorsOrTech = undefined;
      sectionsRemoved++;
      reports.push({
        sectionKey: "disruptorsOrTech",
        removedBullets: 0,
        removedForDuplicate: 0,
        sectionRemoved: true,
      });
    } else {
      const { kept, removedUncited, removedDuplicate } = pruneRows(
        disruptorsOrTech.bullets,
        getSeenUrls(),
        dedupeEnabled,
      );
      bulletsRemovedUncited += removedUncited;
      bulletsRemovedDuplicate += removedDuplicate;
      const sectionRemoved = kept.length === 0;
      reports.push({
        sectionKey: "disruptorsOrTech",
        removedBullets: removedUncited,
        removedForDuplicate: removedDuplicate,
        sectionRemoved,
      });
      if (sectionRemoved) {
        sectionsRemoved++;
        disruptorsOrTech = undefined;
      } else {
        sectionsKept++;
        disruptorsOrTech = { ...disruptorsOrTech, bullets: kept };
      }
    }
  }

  // --- quickHits ---
  let quickHits = resolved.quickHits;
  if (shouldPrune("quickHits") && quickHits !== undefined) {
    const { kept, removedUncited, removedDuplicate } = pruneRows(
      quickHits.items,
      getSeenUrls(),
      dedupeEnabled,
    );
    bulletsRemovedUncited += removedUncited;
    bulletsRemovedDuplicate += removedDuplicate;
    const sectionRemoved = kept.length === 0;
    reports.push({
      sectionKey: "quickHits",
      removedBullets: removedUncited,
      removedForDuplicate: removedDuplicate,
      sectionRemoved,
    });
    if (sectionRemoved) {
      sectionsRemoved++;
      quickHits = undefined;
    } else {
      sectionsKept++;
      quickHits = { ...quickHits, items: kept };
    }
  }

  return {
    resolved: {
      subject: resolved.subject,
      ...(industryPulse !== undefined ? { industryPulse } : {}),
      ...(competitiveLandscape !== undefined ? { competitiveLandscape } : {}),
      ...(dealsAndMovements !== undefined ? { dealsAndMovements } : {}),
      ...(regulatoryPolicyWatch !== undefined ? { regulatoryPolicyWatch } : {}),
      ...(disruptorsOrTech !== undefined ? { disruptorsOrTech } : {}),
      ...(quickHits !== undefined ? { quickHits } : {}),
    },
    reports,
    summary: {
      sectionsRemoved,
      bulletsRemovedUncited,
      bulletsRemovedDuplicate,
      sectionsKept,
    },
  };
}

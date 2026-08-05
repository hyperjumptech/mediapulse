import type { SourceForGeneration } from "../types.js";

const MS_PER_DAY = 86_400_000;

/**
 * Longest age, in days, an article may carry into each section.
 *
 * Collection already drops anything older than seven days, so these only tighten. They differ
 * because sections decay at different speeds: a spot price is worthless a week later, while an
 * earnings release or a draft bill still reads as current. AADI's 2026-08-05 lead priced coal as of
 * July 29 and led `industryPulse` at exactly seven days old.
 *
 * Sections absent from this map inherit {@link DEFAULT_SECTION_MAX_AGE_DAYS}.
 */
export const SECTION_MAX_AGE_DAYS: Readonly<Record<string, number>> = {
  industryPulse: 3,
  competitiveLandscape: 5,
  quickHits: 5,
};

/** Ceiling for sections whose news keeps its value for the full collection window. */
export const DEFAULT_SECTION_MAX_AGE_DAYS = 7;

export type SectionFreshnessResult = {
  sources: SourceForGeneration[];
  droppedCount: number;
  drops: { section: string; ageDays: number; title: string }[];
};

const maxAgeFor = (section: string | null | undefined): number =>
  (typeof section === "string" ? SECTION_MAX_AGE_DAYS[section] : undefined) ??
  DEFAULT_SECTION_MAX_AGE_DAYS;

const ageInDays = (
  publishedAt: string | null | undefined,
  now: Date,
): number | null => {
  if (publishedAt === undefined || publishedAt === null) {
    return null;
  }
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) {
    return null;
  }

  return (now.getTime() - published) / MS_PER_DAY;
};

/**
 * Drops candidates older than their section tolerates.
 *
 * An article with no usable publish date is kept: an unknown date is not evidence of staleness, and
 * dropping on it would delete most of the pool.
 *
 * @param sources - Candidate sources carrying their assigned section.
 * @param now - Current time, injectable for tests.
 * @returns Surviving sources plus what was dropped.
 */
export const dropStaleForSection = (
  sources: readonly SourceForGeneration[],
  now: Date = new Date(),
): SectionFreshnessResult => {
  const kept: SourceForGeneration[] = [];
  const drops: { section: string; ageDays: number; title: string }[] = [];

  for (const source of sources) {
    const age = ageInDays(source.publishedAt, now);
    const limit = maxAgeFor(source.section);
    if (age !== null && age > limit) {
      drops.push({
        section: source.section ?? "unassigned",
        ageDays: Math.round(age * 10) / 10,
        title: source.title,
      });
      continue;
    }
    kept.push(source);
  }

  return { sources: kept, droppedCount: drops.length, drops };
};

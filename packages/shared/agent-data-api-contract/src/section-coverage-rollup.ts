import { z } from "zod";

export const getSectionCoverageRollupQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});

const sectionRollupEntrySchema = z.object({
  /** Average number of queries that targeted this section per QA run. */
  avgCoverage: z.number().nonnegative(),
  /** Average cited bullets shipped in this section per CG run. Null when no CG runs in window. */
  avgFill: z.number().nonnegative().nullable(),
});

const sectionCoverageVersionRowSchema = z.object({
  /**
   * Contract version shared by all runs in this group.
   * `null` for runs that had no Agent Contract attached.
   */
  contractVersion: z.string().nullable(),
  /** Number of QA strategy snapshots that contributed to coverage averages. */
  coverageRunCount: z.number().int().nonnegative(),
  /** Number of CG success runs that contributed to fill averages. */
  fillRunCount: z.number().int().nonnegative(),
  /** Per-section averages keyed by `NewsletterSectionId`. */
  bySection: z.record(z.string(), sectionRollupEntrySchema),
});

export const getSectionCoverageRollupResponseSchema = z.object({
  byVersion: z.array(sectionCoverageVersionRowSchema),
});

export type GetSectionCoverageRollupQuery = z.infer<
  typeof getSectionCoverageRollupQuerySchema
>;
export type SectionCoverageVersionRow = z.infer<
  typeof sectionCoverageVersionRowSchema
>;
export type GetSectionCoverageRollupResponse = z.infer<
  typeof getSectionCoverageRollupResponseSchema
>;

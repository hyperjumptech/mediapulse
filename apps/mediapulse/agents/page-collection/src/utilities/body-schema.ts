import { z } from "zod";

/**
 * Validates page-collection run input: one curated source listing URL per invocation.
 *
 * Accepts a literal URL or a Hermes `db:` data-source expansion string
 * (e.g. `db:curatedSource:listingUrl?where.enabled=true`); expansion is resolved
 * by the scheduler before the agent is invoked.
 */
export const BodySchema = z.object({
  listingUrl: z.string().trim().min(1),
});

export type BodySchemaType = z.infer<typeof BodySchema>;

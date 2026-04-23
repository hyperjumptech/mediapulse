import { z } from "zod";

/**
 * Zod schema for Hermes pipeline / agent invoke `input.tickerId`.
 *
 * Trims surrounding whitespace, rejects empty values, and accepts UUIDs, opaque ids,
 * and `db:` data-source expansion strings (validated separately by Hermes).
 *
 * Align with `agent-data-api-contract` query/body `tickerId` fields (`z.string().trim().min(1)`).
 */
export const hermesTickerIdSchema = z.string().trim().min(1);

/** Inferred TypeScript type for {@link hermesTickerIdSchema}. */
export type HermesTickerId = z.infer<typeof hermesTickerIdSchema>;

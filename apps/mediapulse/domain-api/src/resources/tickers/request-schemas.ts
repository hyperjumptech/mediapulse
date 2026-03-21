import { z } from "zod";

const tickerMetadataBodySchema = z
  .union([z.string(), z.record(z.string(), z.unknown()), z.null()])
  .optional();

/** Validated body for creating a ticker from the Hermes dashboard. */
export const tickerCreateSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  metadata: tickerMetadataBodySchema,
});

/** Validated body for updating a ticker from the Hermes dashboard. */
export const tickerUpdateSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  metadata: tickerMetadataBodySchema,
});

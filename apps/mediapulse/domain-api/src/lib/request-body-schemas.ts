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

/** Validated body for creating an entity type. */
export const entityTypeCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for updating an entity type. */
export const entityTypeUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for creating a relation type. */
export const relationTypeCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for updating a relation type. */
export const relationTypeUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for creating a data source expansion row. */
export const dataSourceExpansionCreateSchema = z.object({
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for updating a data source expansion row. */
export const dataSourceExpansionUpdateSchema = z.object({
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated body for creating a Mediapulse end user. */
export const mediapulseUserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});

/** Validated body for updating a Mediapulse end user. */
export const mediapulseUserUpdateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});

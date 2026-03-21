/**
 * Zod schemas validating JSON bodies for entity-type create (`POST /`) and update (`PATCH /:id`) handlers.
 */

import { z } from "zod";

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

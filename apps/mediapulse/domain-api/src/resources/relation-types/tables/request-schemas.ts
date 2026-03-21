import { z } from "zod";

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

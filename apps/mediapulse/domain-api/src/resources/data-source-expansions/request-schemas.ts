import { z } from "zod";

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

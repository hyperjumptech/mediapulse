import { z } from "zod";

export const BodySchema = z.object({
  tickerId: z.string(),
  timeWindow: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

export type BodySchemaType = z.infer<typeof BodySchema>;

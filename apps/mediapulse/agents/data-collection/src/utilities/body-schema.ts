import { hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

/** Validates the agent run body: required ticker and optional ISO time window. */
export const BodySchema = z.object({
  tickerId: hermesTickerIdSchema,
  timeWindow: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

export type BodySchemaType = z.infer<typeof BodySchema>;

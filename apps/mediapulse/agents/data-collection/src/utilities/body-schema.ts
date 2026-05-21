import { hermesTickerIdSchema } from "@workspace/agent-runtime";
import { z } from "zod";

/** Validates the agent run body: required ticker id. */
export const BodySchema = z.object({
  tickerId: hermesTickerIdSchema,
});

export type BodySchemaType = z.infer<typeof BodySchema>;

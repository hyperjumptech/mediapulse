import { z } from "zod";

/**
 * JSON body Hermes expects on **2xx** responses (PRD §8.2 / schedule execution results).
 * Agents emit this shape; Hermes parses it and sets `semantic_status` from `status`.
 */
export const HermesInvokeEnvelopeSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["success", "failure"]),
  message: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

/** Parsed envelope agents may return on HTTP 200 (subset of fields most agents use). */
export type HermesInvokeEnvelopeV1 = z.infer<
  typeof HermesInvokeEnvelopeSchemaV1
>;

import { z } from "zod";

/**
 * Minimal JSON shape shared by schedule, HTTP trigger, and manual pipeline
 * execution detail GET APIs under `app/api/**`. Keeps the UI and clients from
 * branching on "errors only exists for schedules."
 *
 * Uses `superRefine` so `execution.errors` is required even when the value is
 * `null` (Zod's plain `z.object({ errors: z.unknown() })` would otherwise allow
 * the key to be omitted after stripping unknown input keys).
 */
export const executionDetailApiPayloadSchema = z
  .object({
    execution: z.record(z.unknown()),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (!Object.prototype.hasOwnProperty.call(val.execution, "errors")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["execution", "errors"],
        message:
          "execution.errors must be present on execution detail API payloads (use null when the DB row has no errors JSON).",
      });
    }
  });

export type ExecutionDetailApiPayload = z.infer<
  typeof executionDetailApiPayloadSchema
>;

export const parseExecutionDetailApiPayload = (
  value: unknown,
): ExecutionDetailApiPayload => executionDetailApiPayloadSchema.parse(value);

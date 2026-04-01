import { z } from "zod";

const resendTagSchema = z.object({
  name: z.string().min(1).max(64),
  value: z.string().min(1).max(256),
});

/**
 * Runtime config for the delivery agent (Hermes global config + env fallbacks for secrets/sender).
 */
export const DeliveryConfigSchema = z
  .object({
    /** When set, overrides `RESEND_API_KEY` from env for this invocation. */
    resendApiKey: z.string().min(1).optional(),
    resend: z
      .object({
        from: z.string().min(1).optional(),
        replyTo: z.string().email().optional(),
        /** Optional Resend email tags (observability / routing in Resend dashboard). */
        tags: z.array(resendTagSchema).max(10).optional(),
      })
      .optional(),
    /** When both false, validation fails (at least one part must be sent). */
    send: z
      .object({
        includeHtml: z.boolean().default(true),
        includeText: z.boolean().default(true),
      })
      .default({ includeHtml: true, includeText: true }),
    rateLimit: z
      .object({
        minIntervalMs: z.number().int().positive(),
        maxSendsPerMinute: z.number().int().positive(),
      })
      .default({ minIntervalMs: 600, maxSendsPerMinute: 8 }),
    retry: z
      .object({
        maxAttempts: z.number().int().positive(),
        baseDelayMs: z.number().int().nonnegative(),
        maxDelayMs: z.number().int().positive(),
        jitter: z.boolean(),
      })
      .default({
        maxAttempts: 4,
        baseDelayMs: 500,
        maxDelayMs: 20_000,
        jitter: true,
      }),
    template: z
      .object({
        newsletterVariant: z.enum(["default"]).default("default"),
      })
      .default({ newsletterVariant: "default" }),
  })
  .superRefine((val, ctx) => {
    if (!val.send.includeHtml && !val.send.includeText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "send.includeHtml and send.includeText cannot both be false (Resend requires at least one body part).",
        path: ["send"],
      });
    }
  });

export type DeliveryConfig = z.infer<typeof DeliveryConfigSchema>;

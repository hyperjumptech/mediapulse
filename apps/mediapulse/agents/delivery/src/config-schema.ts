import { z } from "zod";

const resendTagSchema = z.object({
  name: z.string().min(1).max(64),
  value: z.string().min(1).max(256),
});

/**
 * Runtime config for the delivery agent, supplied by Hermes on each invocation.
 * Resend credentials and sender must come from this config (e.g. variables / secrets in Hermes).
 */
export const DeliveryConfigSchema = z
  .object({
    /** Resend API key for this step (use a Hermes secret variable in production). */
    resendApiKey: z.string().min(1),
    resend: z.object({
      from: z.string().min(1),
      replyTo: z.string().email().optional(),
      /** Optional Resend email tags (observability / routing in Resend dashboard). */
      tags: z.array(resendTagSchema).max(10).optional(),
    }),
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
    /** Unsubscribe feature config for per-subscriber token generation. */
    unsubscribe: z.object({
      /** Shared HMAC secret for signing/verifying unsubscribe tokens. */
      secret: z.string().min(1),
      /**
       * Public base URL of the user-registration app (e.g. "https://register.mediapulse.com").
       * The full unsubscribe path `/api/unsubscribe` is appended at runtime.
       */
      baseUrl: z.string().url(),
    }),
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

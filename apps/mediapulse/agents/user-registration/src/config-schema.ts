import { z } from "zod";

export const ConfigSchema = z.object({
  outlookClientId: z.string().min(1),
  outlookClientSecret: z.string().min(1),
  outlookTenantId: z.string().min(1),
  outlookUserId: z.string().min(1),
  resendApiKey: z.string().min(1),
  resendSender: z.string().min(1),
  rateLimit: z
    .object({
      windowMs: z
        .number()
        .int()
        .positive()
        .optional()
        .default(60 * 60 * 1000),
      maxAttempts: z.number().int().positive().optional().default(5),
    })
    .optional()
    .default({}),
  retry: z
    .object({
      maxAttempts: z.number().int().nonnegative().optional().default(3),
      baseDelayMs: z.number().int().positive().optional().default(500),
      maxDelayMs: z.number().int().positive().optional().default(5000),
    })
    .optional()
    .default({}),
  newsletterDeliveryHour: z.number().int().min(0).max(23).optional(),
  newsletterDeliveryTimezone: z.string().optional(),
  newsletterDeliveryTimeLabel: z.string().optional(),
  inboxPageSize: z.number().int().min(1).max(1000).optional().default(50),
  inboxMaxPagesPerRun: z.number().int().positive().optional().default(20),
  mailFolder: z.string().min(1).optional().default("inbox"),
  maxMessageAttempts: z.number().int().positive().optional().default(5),
});

export type UserRegistrationConfig = z.input<typeof ConfigSchema>;

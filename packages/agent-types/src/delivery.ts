import { z } from "zod";

/**
 * Configuration for the delivery agent.
 * Defines how it handles email providers, retries, tracking, and dashboard updates.
 */
export const deliveryConfigSchema = z.object({
  email: z.object({
    provider: z.enum(["resend", "sendgrid"]),
    apiKey: z.string(),
    fromAddress: z.string().email(),
    fromName: z.string(),
    replyTo: z.string().email().optional(),
    templates: z.object({
      daily: z.string(),
      weekly: z.string(),
    }),
    retry: z.object({
      maxAttempts: z.number().int().positive(),
      backoff: z.enum(["exponential", "fixed"]),
      delay: z.number().int().nonnegative(),
    }),
    tracking: z.object({
      openTracking: z.boolean(),
      clickTracking: z.boolean(),
      unsubscribeLink: z.boolean(),
    }),
    feedback: z.object({
      enabled: z.boolean(),
      buttonTypes: z.array(
        z.enum(["like", "dislike", "useful", "irrelevant", "custom"]),
      ),
      customButtons: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            icon: z.string().optional(),
          }),
        )
        .optional(),
      placement: z.enum(["inline", "bottom", "both"]),
      style: z.enum(["buttons", "icons", "text-links"]),
    }),
  }),
  dashboard: z.object({
    updateEndpoint: z.string().url(),
    cacheStrategy: z.enum(["cache-first", "network-first"]),
    notificationEnabled: z.boolean(),
  }),
  rateLimiting: z.object({
    emailsPerMinute: z.number().int().positive(),
    batchSize: z.number().int().positive(),
  }),
});

export type DeliveryConfig = z.infer<typeof deliveryConfigSchema>;

/**
 * Input schema for initiating a delivery task.
 */
export const deliveryInputSchema = z.object({
  tickerId: z.string().uuid(),
  jobId: z.string().optional(),
});

export type DeliveryInput = z.infer<typeof deliveryInputSchema>;

/**
 * Output schema returned upon completion of a delivery task.
 */
export const deliveryOutputSchema = z.object({
  agentId: z.literal("delivery"),
  agentVersion: z.string(),
  tickerId: z.string().uuid(),
  jobId: z.string().optional(),
  timestamp: z.string().datetime(),
  executionTime: z.number(),
  delivery: z.object({
    emails: z.array(
      z.object({
        status: z.enum(["sent", "failed", "bounced", "pending"]),
        email: z.string().email(),
        messageId: z.string().optional(),
        error: z.string().optional(),
        deliveredAt: z.string().datetime().optional(),
      }),
    ),
    dashboard: z.object({
      updated: z.boolean(),
      publishedAt: z.string().datetime().optional(),
      url: z.string().url().optional(),
    }),
  }),
  metadata: z.object({
    deliveryTime: z.number(),
    errors: z
      .array(
        z.object({
          type: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

export type DeliveryOutput = z.infer<typeof deliveryOutputSchema>;

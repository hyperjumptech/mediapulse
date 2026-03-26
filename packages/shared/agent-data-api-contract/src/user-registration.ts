import { z } from "zod";

// Request schemas
export const postUserRegistrationRegisterBodySchema = z.object({
  email: z.string().email(),
  tickerSymbol: z.string(),
  name: z.string().nullable().optional(),
  audit: z
    .object({
      graphMessageId: z.string().optional(),
      receivedAt: z.string().optional(),
    })
    .optional(),
});

export const postUserRegistrationConfirmBodySchema = z.object({
  userTickerId: z.string(),
  audit: z
    .object({
      graphMessageId: z.string().optional(),
    })
    .optional(),
});

// Response schemas
export const postUserRegistrationRegisterResponseSchema = z.object({
  tickerKnown: z.boolean(),
  userTickerId: z.string().optional(),
  confirmationNeeded: z.boolean(),
  subscriptionChanged: z.boolean(),
});

export const postUserRegistrationConfirmResponseSchema = z.object({
  success: z.boolean(),
});

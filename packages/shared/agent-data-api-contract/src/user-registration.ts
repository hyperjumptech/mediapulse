import { z } from "zod";

// Request schemas
export const postUserRegistrationRegisterBodySchema = z.object({
  email: z.string().email(),
  tickerSymbol: z.string(),
  name: z.string().nullable().optional(),
  confirmed: z.boolean().optional(),
  audit: z
    .object({
      graphMessageId: z.string().optional(),
      receivedAt: z.string().optional(),
    })
    .optional(),
});

export const postUserRegistrationConfirmBodySchema = z.object({
  userTickerId: z.string().uuid(),
  audit: z
    .object({
      graphMessageId: z.string().optional(),
    })
    .optional(),
});

export const userRegistrationUnsubscribeMethodSchema = z.enum([
  "link",
  "one_click",
]);

export const userRegistrationUnsubscribeQuerySchema = z.object({
  token: z.string().min(1),
});

export const postUserRegistrationUnsubscribeBodySchema = z.object({
  token: z.string().min(1),
});

// Response schemas
export const postUserRegistrationRegisterResponseSchema = z.object({
  tickerKnown: z.boolean(),
  userTickerId: z.string().uuid().optional(),
  isNewSubscription: z.boolean(),
  subscriptionChanged: z.boolean(),
});

export const postUserRegistrationConfirmResponseSchema = z.object({
  success: z.boolean(),
});

export const userRegistrationUnsubscribeResponseSchema = z.object({
  status: z.enum([
    "unsubscribed",
    "already_unsubscribed",
    "not_found",
    "invalid",
    "expired",
  ]),
  displaySymbol: z.string().optional(),
});

export type PostUserRegistrationRegisterBody = z.infer<
  typeof postUserRegistrationRegisterBodySchema
>;
export type PostUserRegistrationConfirmBody = z.infer<
  typeof postUserRegistrationConfirmBodySchema
>;
export type PostUserRegistrationRegisterResponse = z.infer<
  typeof postUserRegistrationRegisterResponseSchema
>;
export type PostUserRegistrationConfirmResponse = z.infer<
  typeof postUserRegistrationConfirmResponseSchema
>;
export type UserRegistrationUnsubscribeMethod = z.infer<
  typeof userRegistrationUnsubscribeMethodSchema
>;
export type UserRegistrationUnsubscribeQuery = z.infer<
  typeof userRegistrationUnsubscribeQuerySchema
>;
export type PostUserRegistrationUnsubscribeBody = z.infer<
  typeof postUserRegistrationUnsubscribeBodySchema
>;
export type UserRegistrationUnsubscribeResponse = z.infer<
  typeof userRegistrationUnsubscribeResponseSchema
>;

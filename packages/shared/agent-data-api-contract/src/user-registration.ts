import { z } from "zod";

/** Query for listing tickers available on the registration form (no parameters). */
export const getUserRegistrationTickersQuerySchema = z.object({});

/** One ticker row returned for registration picker (maps to DB `ticker.symbol` / `ticker.name`). */
export const userRegistrationTickerListItemSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

/** Response for GET user-registration tickers list. */
export const getUserRegistrationTickersResponseSchema = z.object({
  tickers: z.array(userRegistrationTickerListItemSchema),
});

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
export type GetUserRegistrationTickersQuery = z.infer<
  typeof getUserRegistrationTickersQuerySchema
>;
export type GetUserRegistrationTickersResponse = z.infer<
  typeof getUserRegistrationTickersResponseSchema
>;

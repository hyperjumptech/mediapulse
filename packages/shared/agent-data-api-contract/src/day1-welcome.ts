import { z } from "zod";

import { newsletterLanguageSchema } from "./newsletter-translation.js";

export const getDay1WelcomeQuerySchema = z.object({
  dispatchId: z.guid(),
});

export const day1WelcomeStorySchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  points: z.array(z.string()),
});

export const day1WelcomeRecipientSchema = z.object({
  email: z.string().email(),
});

export const day1WelcomeSchema = z.object({
  dispatchId: z.guid(),
  tickerId: z.string(),
  userTickerId: z.guid(),
  language: newsletterLanguageSchema,
  sentAt: z.string().datetime().nullable(),
  recipient: day1WelcomeRecipientSchema.nullable(),
  tickerSymbol: z.string(),
  companyName: z.string(),
  overview: z.string().nullable(),
  businessOperation: z.string().nullable(),
  classification: z.array(z.string()),
  competitors: z.array(z.string()),
  regulators: z.array(z.string()),
  recentStories: z.array(day1WelcomeStorySchema),
});

export const getDay1WelcomeResponseSchema = z.object({
  welcome: day1WelcomeSchema.nullable(),
});

export const postDay1WelcomeBodySchema = z.object({
  dispatchId: z.guid(),
  resendEmailId: z.string().min(1).optional(),
});

export const postDay1WelcomeResponseSchema = z.object({
  message: z.string(),
});

export const day1WelcomeClaimBodySchema = z.object({
  dispatchId: z.guid(),
});

export const postDay1WelcomeClaimResponseSchema = z.object({
  claimed: z.boolean(),
});

export const postDay1WelcomeClaimReleaseResponseSchema = z.object({
  released: z.boolean(),
});

export type GetDay1WelcomeQuery = z.infer<typeof getDay1WelcomeQuerySchema>;
export type Day1WelcomeStory = z.infer<typeof day1WelcomeStorySchema>;
export type Day1Welcome = z.infer<typeof day1WelcomeSchema>;
export type GetDay1WelcomeResponse = z.infer<
  typeof getDay1WelcomeResponseSchema
>;
export type PostDay1WelcomeBody = z.infer<typeof postDay1WelcomeBodySchema>;
export type Day1WelcomeClaimBody = z.infer<typeof day1WelcomeClaimBodySchema>;

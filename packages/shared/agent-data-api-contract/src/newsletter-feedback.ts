import { z } from "zod";

/** Sentiment label assigned to a newsletter reply by the classifier. */
export const feedbackSentimentSchema = z.enum([
  "positive",
  "negative",
  "neutral",
  "mixed",
]);

/** Category label assigned to a newsletter reply by the classifier. */
export const feedbackCategorySchema = z.enum([
  "praise",
  "complaint",
  "feature_request",
  "bug",
  "question",
  "other",
]);

/** Request body for recording a classified newsletter reply. */
export const postNewsletterFeedbackRecordBodySchema = z.object({
  /** Outlook Graph message id; used as the idempotency key. */
  graphMessageId: z.string().min(1),
  senderEmail: z.string().email(),
  subject: z.string().nullable().optional(),
  rawBody: z.string(),
  receivedAt: z.string().datetime(),
  /**
   * The reply's `In-Reply-To` header value. The server parses a self-describing
   * newsletter Message-ID out of it to correlate the reply to a sent newsletter.
   */
  inReplyToMessageId: z.string().nullable().optional(),
  sentiment: feedbackSentimentSchema,
  category: feedbackCategorySchema,
  classifierModel: z.string().optional(),
});

/** Correlation result: which subscriber/newsletter the reply was linked to. */
export const newsletterFeedbackCorrelationSchema = z.object({
  userId: z.string().uuid().optional(),
  userTickerId: z.string().uuid().optional(),
  newsletterId: z.string().uuid().optional(),
});

/** Response for recording a newsletter reply. */
export const postNewsletterFeedbackRecordResponseSchema = z.object({
  feedbackId: z.string().uuid(),
  /** False when the `graphMessageId` already existed (idempotent replay). */
  created: z.boolean(),
  correlated: newsletterFeedbackCorrelationSchema,
});

export type FeedbackSentiment = z.infer<typeof feedbackSentimentSchema>;
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type PostNewsletterFeedbackRecordBody = z.infer<
  typeof postNewsletterFeedbackRecordBodySchema
>;
export type NewsletterFeedbackCorrelation = z.infer<
  typeof newsletterFeedbackCorrelationSchema
>;
export type PostNewsletterFeedbackRecordResponse = z.infer<
  typeof postNewsletterFeedbackRecordResponseSchema
>;

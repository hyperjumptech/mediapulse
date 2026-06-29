/**
 * Maps `NewsletterFeedback` rows to list items for the feedback Hermes table API.
 */

import type {
  FeedbackCategory,
  FeedbackSentiment,
  NewsletterFeedback,
} from "@mediapulse/database";

/** Prisma row shape for the feedback list query. */
export type NewsletterFeedbackListRow = NewsletterFeedback;

const sentimentLabels: Record<FeedbackSentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  mixed: "Mixed",
};

const categoryLabels: Record<FeedbackCategory, string> = {
  praise: "Praise",
  complaint: "Complaint",
  feature_request: "Feature request",
  bug: "Bug",
  question: "Question",
  other: "Other",
};

/**
 * Returns a human-readable label for a classified feedback sentiment.
 *
 * @param sentiment - Prisma `FeedbackSentiment` value, or `null` when unclassified.
 * @returns Display label, or `"—"` when there is no sentiment.
 */
export const formatSentiment = (
  sentiment: FeedbackSentiment | null,
): string => {
  if (sentiment === null) return "—";

  return sentimentLabels[sentiment];
};

/**
 * Returns a human-readable label for a classified feedback category.
 *
 * @param category - Prisma `FeedbackCategory` value, or `null` when unclassified.
 * @returns Display label, or `"—"` when there is no category.
 */
export const formatCategory = (category: FeedbackCategory | null): string => {
  if (category === null) return "—";

  return categoryLabels[category];
};

/** Shape of one row in the feedback list table. */
export type ListItem = {
  id: string;
  senderEmail: string;
  subject: string;
  sentiment: string;
  category: string;
  receivedAt: string;
  createdAt: string;
};

/**
 * Maps a Prisma newsletter feedback row to the JSON list item.
 *
 * @param row - Row from `prisma.newsletterFeedback.findMany`.
 * @returns Serializable list row for the Hermes dashboard.
 */
export const mapRowToListItem = (row: NewsletterFeedbackListRow): ListItem => ({
  id: row.id,
  senderEmail: row.senderEmail,
  subject: row.subject ?? "—",
  sentiment: formatSentiment(row.sentiment),
  category: formatCategory(row.category),
  receivedAt: row.receivedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

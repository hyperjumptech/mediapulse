/**
 * Maps a `NewsletterFeedback` row to the detail payload for the feedback Hermes table API.
 */

import type { NewsletterFeedback } from "@mediapulse/database";
import { formatCategory, formatSentiment } from "./list-mapper";

/** Prisma row shape passed to {@link mapRowToDetailItem}. */
export type NewsletterFeedbackDetailRow = NewsletterFeedback;

/** Shape of the detail payload exposed by `GET /resources/feedback/:id`. */
export type DetailItem = {
  id: string;
  title: string;
  senderEmail: string;
  subject: string | null;
  receivedAt: string;
  sentiment: string;
  category: string;
  classifierModel: string | null;
  classifiedAt: string | null;
  userId: string | null;
  userTickerId: string | null;
  newsletterId: string | null;
  rawBody: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Maps a Prisma newsletter feedback row to the detail response.
 *
 * `title` is what the generic dashboard detail page renders as the header; it
 * falls back to the sender when the reply has no subject.
 *
 * @param row - Newsletter feedback row.
 * @returns Detail item for the Hermes dashboard.
 */
export const mapRowToDetailItem = (
  row: NewsletterFeedbackDetailRow,
): DetailItem => ({
  id: row.id,
  title: row.subject ?? `Reply from ${row.senderEmail}`,
  senderEmail: row.senderEmail,
  subject: row.subject,
  receivedAt: row.receivedAt.toISOString(),
  sentiment: formatSentiment(row.sentiment),
  category: formatCategory(row.category),
  classifierModel: row.classifierModel,
  classifiedAt: row.classifiedAt?.toISOString() ?? null,
  userId: row.userId,
  userTickerId: row.userTickerId,
  newsletterId: row.newsletterId,
  rawBody: row.rawBody,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

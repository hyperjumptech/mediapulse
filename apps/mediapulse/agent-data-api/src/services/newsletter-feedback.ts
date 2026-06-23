import { prisma as mediapulsePrisma } from "@mediapulse/database";
import type {
  FeedbackCategory,
  FeedbackSentiment,
  NewsletterFeedbackCorrelation,
  PostNewsletterFeedbackRecordResponse,
} from "@workspace/agent-data-api-contract";

import { isPrismaUniqueViolation } from "./is-prisma-unique-violation.js";

/**
 * Matches a self-describing newsletter Message-ID of the form
 * `<nl.{newsletterId}.{userTickerId}@domain>` set by the delivery agent.
 * UUIDs contain no dots, so the two ids parse unambiguously.
 */
const SELF_DESCRIBING_MESSAGE_ID = /<nl\.([0-9a-f-]{36})\.([0-9a-f-]{36})@/i;

/**
 * Extracts `{ newsletterId, userTickerId }` from an `In-Reply-To`/`References`
 * header value, when it carries a self-describing newsletter Message-ID.
 *
 * @param inReplyToMessageId - Raw header value (may include angle brackets).
 */
export function parseNewsletterMessageId(
  inReplyToMessageId: string | null | undefined,
): { newsletterId: string; userTickerId: string } | null {
  if (!inReplyToMessageId) {
    return null;
  }
  const match = SELF_DESCRIBING_MESSAGE_ID.exec(inReplyToMessageId);
  if (!match || match[1] === undefined || match[2] === undefined) {
    return null;
  }

  return { newsletterId: match[1], userTickerId: match[2] };
}

/**
 * Correlates a reply to a subscriber/newsletter using the self-describing
 * Message-ID first, then falls back to the sender email. Every link is
 * best-effort; unresolved links are left undefined.
 */
async function correlateFeedback(
  senderEmail: string,
  inReplyToMessageId: string | null | undefined,
): Promise<NewsletterFeedbackCorrelation> {
  const correlation: NewsletterFeedbackCorrelation = {};

  const parsed = parseNewsletterMessageId(inReplyToMessageId);
  if (parsed) {
    const userTicker = await mediapulsePrisma.userTicker.findUnique({
      where: { id: parsed.userTickerId },
      select: { id: true, userId: true },
    });
    if (userTicker) {
      correlation.userTickerId = userTicker.id;
      correlation.userId = userTicker.userId;
    }

    const newsletter = await mediapulsePrisma.newsletter.findUnique({
      where: { id: parsed.newsletterId },
      select: { id: true },
    });
    if (newsletter) {
      correlation.newsletterId = newsletter.id;
    }
  }

  // Fall back to (or cross-check against) the sender address.
  if (correlation.userId === undefined) {
    const user = await mediapulsePrisma.mediapulseUser.findUnique({
      where: { email: senderEmail },
      select: { id: true },
    });
    if (user) {
      correlation.userId = user.id;
    }
  }

  return correlation;
}

/**
 * Records a classified newsletter reply, idempotent on `graphMessageId`.
 * Stores the raw body regardless of whether correlation succeeds.
 *
 * @returns `feedbackId`, `created` (false on idempotent replay), and the
 *   resolved correlation links.
 */
export async function recordNewsletterFeedback({
  graphMessageId,
  senderEmail,
  subject,
  rawBody,
  receivedAt,
  inReplyToMessageId,
  sentiment,
  category,
  classifierModel,
}: {
  graphMessageId: string;
  senderEmail: string;
  subject?: string | null;
  rawBody: string;
  receivedAt: string;
  inReplyToMessageId?: string | null;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  classifierModel?: string;
}): Promise<PostNewsletterFeedbackRecordResponse> {
  const normalizedEmail = senderEmail.trim().toLowerCase();

  const existing = await mediapulsePrisma.newsletterFeedback.findUnique({
    where: { graphMessageId },
    select: {
      id: true,
      userId: true,
      userTickerId: true,
      newsletterId: true,
    },
  });
  if (existing) {
    return {
      feedbackId: existing.id,
      created: false,
      correlated: {
        userId: existing.userId ?? undefined,
        userTickerId: existing.userTickerId ?? undefined,
        newsletterId: existing.newsletterId ?? undefined,
      },
    };
  }

  const correlated = await correlateFeedback(
    normalizedEmail,
    inReplyToMessageId,
  );

  try {
    const created = await mediapulsePrisma.newsletterFeedback.create({
      data: {
        graphMessageId,
        senderEmail: normalizedEmail,
        subject: subject ?? null,
        rawBody,
        receivedAt: new Date(receivedAt),
        inReplyTo: inReplyToMessageId ?? null,
        sentiment,
        category,
        classifierModel: classifierModel ?? null,
        classifiedAt: new Date(),
        userId: correlated.userId ?? null,
        userTickerId: correlated.userTickerId ?? null,
        newsletterId: correlated.newsletterId ?? null,
      },
      select: { id: true },
    });

    return { feedbackId: created.id, created: true, correlated };
  } catch (error) {
    // Concurrent insert of the same reply: re-read and return idempotently.
    if (isPrismaUniqueViolation(error)) {
      const row = await mediapulsePrisma.newsletterFeedback.findUnique({
        where: { graphMessageId },
        select: {
          id: true,
          userId: true,
          userTickerId: true,
          newsletterId: true,
        },
      });
      if (row) {
        return {
          feedbackId: row.id,
          created: false,
          correlated: {
            userId: row.userId ?? undefined,
            userTickerId: row.userTickerId ?? undefined,
            newsletterId: row.newsletterId ?? undefined,
          },
        };
      }
    }
    throw error;
  }
}

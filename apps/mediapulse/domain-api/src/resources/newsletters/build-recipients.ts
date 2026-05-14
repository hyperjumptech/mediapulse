import type { Prisma, prisma } from "@mediapulse/database";

import { deriveRecipientStatus } from "./derive-recipient-status";

/**
 * Maximum number of recipient rows the detail handler will return for a single
 * newsletter. PRD §5: cap recipients to keep the payload bounded; when the cap
 * is hit, the response sets `recipientsTruncated: true`.
 */
export const NEWSLETTER_DETAIL_RECIPIENTS_CAP = 2000;

/** Shape of one recipient entry in the detail payload. */
export type RecipientPayload = {
  userTickerId: string;
  status: "delivered" | "failed" | "skipped" | "not_attempted";
  attempts: number;
  lastErrorCode: string | null;
  errorCategory: string | null;
  resendEmailId: string | null;
  inconsistent: boolean;
};

/** Output of {@link buildRecipients}. */
export type BuildRecipientsResult = {
  recipients: RecipientPayload[];
  truncated: boolean;
  inconsistentUserTickerIds: string[];
  notAttemptedAtSendTime: Array<{ userTickerId: string; runId: string | null }>;
};

/** Prisma collaborator surface for {@link buildRecipients}. */
export type BuildRecipientsDeps = {
  userTicker: Pick<typeof prisma.userTicker, "findMany">;
  newsletterDeliveryCheckpoint: Pick<
    typeof prisma.newsletterDeliveryCheckpoint,
    "findMany"
  >;
  deliveryRun: Pick<typeof prisma.deliveryRun, "findMany">;
};

/**
 * Builds the recipients section of the newsletter detail payload by combining
 * three sources:
 *
 * - Enabled `UserTicker` rows for the ticker (current set of subscribers).
 * - `NewsletterDeliveryCheckpoint` rows scoped to this newsletter.
 * - Latest `DeliveryRecipientOutcome` per `(newsletter, userTicker)` from the
 *   `DeliveryRun` rows that reference this newsletter.
 *
 * The function applies the precedence rule from {@link deriveRecipientStatus},
 * caps the result at {@link NEWSLETTER_DETAIL_RECIPIENTS_CAP}, and returns
 * structured metadata so the route can emit log warnings for the
 * `not_attempted` and `inconsistent` cases without leaking subscriber emails.
 *
 * @param newsletterId - Newsletter id under inspection.
 * @param tickerId - Ticker the newsletter belongs to.
 * @param deps - Prisma delegate collaborators.
 * @returns Recipients payload plus diagnostics for the route to log.
 */
export const buildRecipients = async (
  newsletterId: string,
  tickerId: string,
  deps: BuildRecipientsDeps,
): Promise<BuildRecipientsResult> => {
  const enabledArgs = {
    where: { tickerId, enabled: true },
    select: { id: true },
  } satisfies Prisma.UserTickerFindManyArgs;

  const checkpointArgs = {
    where: { newsletterId },
    select: { userTickerId: true },
  } satisfies Prisma.NewsletterDeliveryCheckpointFindManyArgs;

  const deliveryRunsArgs = {
    where: { newsletterId },
    select: {
      id: true,
      createdAt: true,
      recipients: {
        select: {
          userTickerId: true,
          status: true,
          attempts: true,
          lastErrorCode: true,
          errorCategory: true,
          resendEmailId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.DeliveryRunFindManyArgs;

  const [enabledRows, checkpointRows, deliveryRuns] = await Promise.all([
    deps.userTicker.findMany(enabledArgs),
    deps.newsletterDeliveryCheckpoint.findMany(checkpointArgs),
    deps.deliveryRun.findMany(deliveryRunsArgs),
  ]);

  const checkpointSet = new Set(checkpointRows.map((row) => row.userTickerId));

  type OutcomeRow = {
    userTickerId: string;
    status: "success" | "failed" | "skipped";
    attempts: number;
    lastErrorCode: string | null;
    errorCategory: string | null;
    resendEmailId: string | null;
    runId: string;
  };
  const latestOutcomeByUserTicker = new Map<string, OutcomeRow>();

  for (const run of deliveryRuns) {
    for (const recipient of run.recipients) {
      if (!latestOutcomeByUserTicker.has(recipient.userTickerId)) {
        latestOutcomeByUserTicker.set(recipient.userTickerId, {
          ...recipient,
          runId: run.id,
        });
      }
    }
  }

  const enabledIds = new Set(enabledRows.map((row) => row.id));
  const observedIds = new Set<string>([
    ...checkpointSet,
    ...latestOutcomeByUserTicker.keys(),
  ]);

  const allUserTickerIds = new Set<string>([...enabledIds, ...observedIds]);

  const recipients: RecipientPayload[] = [];
  const inconsistentUserTickerIds: string[] = [];
  const notAttemptedAtSendTime: Array<{
    userTickerId: string;
    runId: string | null;
  }> = [];

  const latestRunId = deliveryRuns[0]?.id ?? null;

  for (const userTickerId of allUserTickerIds) {
    const outcome = latestOutcomeByUserTicker.get(userTickerId);
    const { status, inconsistent } = deriveRecipientStatus({
      hasCheckpoint: checkpointSet.has(userTickerId),
      latestOutcomeStatus: outcome?.status ?? null,
    });

    recipients.push({
      userTickerId,
      status,
      attempts: outcome?.attempts ?? 0,
      lastErrorCode: outcome?.lastErrorCode ?? null,
      errorCategory: outcome?.errorCategory ?? null,
      resendEmailId: outcome?.resendEmailId ?? null,
      inconsistent,
    });

    if (inconsistent) {
      inconsistentUserTickerIds.push(userTickerId);
    }
    if (
      status === "not_attempted" &&
      enabledIds.has(userTickerId) &&
      latestRunId
    ) {
      notAttemptedAtSendTime.push({ userTickerId, runId: latestRunId });
    }
  }

  const truncated = recipients.length > NEWSLETTER_DETAIL_RECIPIENTS_CAP;
  const capped = truncated
    ? recipients.slice(0, NEWSLETTER_DETAIL_RECIPIENTS_CAP)
    : recipients;

  return {
    recipients: capped,
    truncated,
    inconsistentUserTickerIds,
    notAttemptedAtSendTime,
  };
};

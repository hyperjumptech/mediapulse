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
  email: string | null;
  name: string | null;
  displayName: string;
  status: "delivered" | "failed" | "skipped" | "not_attempted";
  statusBadge: "success" | "destructive" | "muted" | "outline";
  attempts: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  errorCategory: string | null;
  resendEmailId: string | null;
  deliveredAt: string | null;
  inconsistent: boolean;
};

/** Output of {@link buildRecipients}. */
export type BuildRecipientsResult = {
  recipients: RecipientPayload[];
  truncated: boolean;
  totalCount: number;
  deliveredCount: number;
  enabledAtSendTime: number;
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

const STATUS_TO_BADGE = {
  delivered: "success",
  failed: "destructive",
  skipped: "muted",
  not_attempted: "outline",
} as const satisfies Record<
  RecipientPayload["status"],
  RecipientPayload["statusBadge"]
>;

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
    select: {
      id: true,
      user: { select: { email: true, name: true } },
    },
  } satisfies Prisma.UserTickerFindManyArgs;

  const checkpointArgs = {
    where: { newsletterId },
    select: { userTickerId: true, deliveredAt: true },
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
          lastErrorMessage: true,
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

  const checkpointDeliveredAtById = new Map<string, Date>();
  for (const row of checkpointRows) {
    checkpointDeliveredAtById.set(row.userTickerId, row.deliveredAt);
  }
  const checkpointSet = new Set(checkpointDeliveredAtById.keys());

  type OutcomeRow = {
    userTickerId: string;
    status: "success" | "failed" | "skipped";
    attempts: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
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

  type EnabledUser = { email: string | null; name: string | null };
  const enabledUserById = new Map<string, EnabledUser>();
  for (const row of enabledRows) {
    enabledUserById.set(row.id, {
      email: row.user?.email ?? null,
      name: row.user?.name ?? null,
    });
  }
  const enabledIds = new Set(enabledUserById.keys());
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
    const user = enabledUserById.get(userTickerId) ?? null;
    const deliveredAt = checkpointDeliveredAtById.get(userTickerId) ?? null;
    const displayName =
      user?.name && user.name.trim().length > 0
        ? user.email
          ? `${user.name} <${user.email}>`
          : user.name
        : (user?.email ?? userTickerId);

    recipients.push({
      userTickerId,
      email: user?.email ?? null,
      name: user?.name ?? null,
      displayName,
      status,
      statusBadge: STATUS_TO_BADGE[status],
      attempts: status === "not_attempted" ? null : (outcome?.attempts ?? 0),
      lastErrorCode: outcome?.lastErrorCode ?? null,
      lastErrorMessage: outcome?.lastErrorMessage ?? null,
      errorCategory: outcome?.errorCategory ?? null,
      resendEmailId: outcome?.resendEmailId ?? null,
      deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
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

  recipients.sort((left, right) => {
    const leftKey = (left.email ?? left.displayName ?? "").toLowerCase();
    const rightKey = (right.email ?? right.displayName ?? "").toLowerCase();
    return leftKey.localeCompare(rightKey);
  });

  const totalCount = recipients.length;
  const truncated = totalCount > NEWSLETTER_DETAIL_RECIPIENTS_CAP;
  const capped = truncated
    ? recipients.slice(0, NEWSLETTER_DETAIL_RECIPIENTS_CAP)
    : recipients;

  const deliveredCount = recipients.filter(
    (r) => r.status === "delivered",
  ).length;
  const enabledAtSendTime =
    deliveryRuns[0] &&
    (deliveryRuns[0] as { recipients?: unknown[] }).recipients
      ? (deliveryRuns[0] as { recipients: unknown[] }).recipients.length
      : enabledIds.size;

  return {
    recipients: capped,
    truncated,
    totalCount,
    deliveredCount,
    enabledAtSendTime,
    inconsistentUserTickerIds,
    notAttemptedAtSendTime,
  };
};

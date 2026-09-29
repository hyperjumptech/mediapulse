import type { Prisma, PrismaClient } from "@mediapulse/database";

import type { SendHermesDomainEvent } from "./hermes-domain-event-client.js";

export const DEFAULT_DAY1_TRIGGER_TIMEOUT_MS = 5_000;
export const DEFAULT_DAY1_LATEST_ISSUE_MAX_AGE_HOURS = 36;
export const DEFAULT_DAY1_BOOTSTRAP_DEDUPE_MINUTES = 120;

export const DAY1_FULL_CHAIN_EVENT = "day1.full-chain";
export const DAY1_LATEST_ISSUE_EVENT = "day1.latest-issue";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const MAX_STORED_ERROR_LENGTH = 500;
const NEWSLETTER_BASE_LANGUAGE = "en";

export type Day1Language = "en" | "id";

export type Day1SkipReason =
  | "already_dispatched"
  | "not_configured"
  | "missing_translation"
  | "nightly_owns_ticker"
  | "bootstrap_in_flight";

export type Day1DispatchDecision =
  | { kind: "bootstrap" }
  | { kind: "latest_issue" }
  | { kind: "none"; reason: Day1SkipReason };

export type Day1DispatchState = {
  subscriberLanguage: Day1Language;
  latestIssue: { createdAt: Date; languages: Day1Language[] } | null;
  otherActiveSubscriptionCount: number;
  recentBootstrapCount: number;
  recentSubscriptionDispatchCount: number;
};

export type Day1DispatcherConfig = {
  eventTimeoutMs: number;
  latestIssueMaxAgeHours: number;
  bootstrapDedupeMinutes: number;
};

export type Day1DispatcherEnv = {
  MEDIAPULSE_DAY1_TRIGGER_TIMEOUT_MS?: number;
  MEDIAPULSE_DAY1_LATEST_ISSUE_MAX_AGE_HOURS?: number;
  MEDIAPULSE_DAY1_BOOTSTRAP_DEDUPE_MINUTES?: number;
};

export type Day1Activation = {
  userTickerId: string;
};

export type Day1DispatchOutcome =
  | { status: "not_active" }
  | { status: "skipped"; dispatchId: string; reason: Day1SkipReason }
  | {
      status: "fired";
      dispatchId: string;
      kind: "bootstrap" | "latest_issue";
      executionId: string;
    }
  | {
      status: "failed";
      dispatchId: string;
      kind: "bootstrap" | "latest_issue";
      error: string;
    };

export type Day1Dispatcher = (
  activation: Day1Activation,
) => Promise<Day1DispatchOutcome>;

export type Day1DispatcherDb = Pick<
  PrismaClient,
  "$transaction" | "userTicker" | "day1NewsletterDispatch"
>;

export type CreateDay1DispatcherDeps = {
  db: Day1DispatcherDb;
  sendEvent: SendHermesDomainEvent;
  config: Day1DispatcherConfig;
  now?: () => Date;
};

type ActiveSubscription = {
  id: string;
  tickerId: string;
  language: Day1Language;
};

const skip = (reason: Day1SkipReason): Day1DispatchDecision => ({
  kind: "none",
  reason,
});

export const decideDay1Dispatch = (
  state: Day1DispatchState,
  latestIssueMaxAgeHours: number,
  now: Date,
): Day1DispatchDecision => {
  if (state.recentSubscriptionDispatchCount > 0) {
    return skip("already_dispatched");
  }
  const bootstrapInFlight = state.recentBootstrapCount > 0;
  const { latestIssue } = state;
  if (latestIssue === null) {
    return bootstrapInFlight
      ? skip("bootstrap_in_flight")
      : { kind: "bootstrap" };
  }
  const issueAgeMs = now.getTime() - latestIssue.createdAt.getTime();
  const isFresh = issueAgeMs <= latestIssueMaxAgeHours * HOUR_MS;
  if (isFresh) {
    const hasSubscriberLanguage = latestIssue.languages.includes(
      state.subscriberLanguage,
    );

    return hasSubscriberLanguage
      ? { kind: "latest_issue" }
      : skip("missing_translation");
  }
  if (state.otherActiveSubscriptionCount > 0) {
    return skip("nightly_owns_ticker");
  }

  return bootstrapInFlight
    ? skip("bootstrap_in_flight")
    : { kind: "bootstrap" };
};

const positiveOr = (value: number | undefined, fallback: number): number =>
  value != null && Number.isFinite(value) && value > 0 ? value : fallback;

export const readDay1DispatcherConfig = (
  source: Day1DispatcherEnv,
): Day1DispatcherConfig => ({
  eventTimeoutMs: positiveOr(
    source.MEDIAPULSE_DAY1_TRIGGER_TIMEOUT_MS,
    DEFAULT_DAY1_TRIGGER_TIMEOUT_MS,
  ),
  latestIssueMaxAgeHours: positiveOr(
    source.MEDIAPULSE_DAY1_LATEST_ISSUE_MAX_AGE_HOURS,
    DEFAULT_DAY1_LATEST_ISSUE_MAX_AGE_HOURS,
  ),
  bootstrapDedupeMinutes: positiveOr(
    source.MEDIAPULSE_DAY1_BOOTSTRAP_DEDUPE_MINUTES,
    DEFAULT_DAY1_BOOTSTRAP_DEDUPE_MINUTES,
  ),
});

const findActiveSubscription = async (
  db: Day1DispatcherDb,
  userTickerId: string,
): Promise<ActiveSubscription | null> => {
  const subscription = await db.userTicker.findUnique({
    where: { id: userTickerId },
    select: {
      id: true,
      tickerId: true,
      language: true,
      enabled: true,
      registrationConfirmedAt: true,
      user: { select: { enabled: true } },
    },
  });
  const isActive =
    subscription != null &&
    subscription.enabled &&
    subscription.registrationConfirmedAt != null &&
    subscription.user.enabled;
  if (!isActive) {
    return null;
  }

  return {
    id: subscription.id,
    tickerId: subscription.tickerId,
    language: subscription.language,
  };
};

const loadDispatchState = async (
  tx: Prisma.TransactionClient,
  subscription: ActiveSubscription,
  bootstrapDedupeMinutes: number,
  now: Date,
): Promise<Day1DispatchState> => {
  const latestNewsletter = await tx.newsletter.findFirst({
    where: { tickerId: subscription.tickerId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, translations: { select: { language: true } } },
  });
  const otherActiveSubscriptionCount = await tx.userTicker.count({
    where: {
      tickerId: subscription.tickerId,
      id: { not: subscription.id },
      enabled: true,
      registrationConfirmedAt: { not: null },
      user: { enabled: true },
    },
  });
  const dedupeSince = new Date(
    now.getTime() - bootstrapDedupeMinutes * MINUTE_MS,
  );
  const recentBootstrapCount = await tx.day1NewsletterDispatch.count({
    where: {
      tickerId: subscription.tickerId,
      kind: "bootstrap",
      status: { in: ["dispatching", "fired"] },
      createdAt: { gte: dedupeSince },
    },
  });
  const recentSubscriptionDispatchCount = await tx.day1NewsletterDispatch.count(
    {
      where: {
        userTickerId: subscription.id,
        status: { in: ["dispatching", "fired"] },
        createdAt: { gte: dedupeSince },
      },
    },
  );
  const latestIssue =
    latestNewsletter === null
      ? null
      : {
          createdAt: latestNewsletter.createdAt,
          languages: [
            NEWSLETTER_BASE_LANGUAGE,
            ...latestNewsletter.translations.map(
              (translation) => translation.language,
            ),
          ] as Day1Language[],
        };

  return {
    subscriberLanguage: subscription.language,
    latestIssue,
    otherActiveSubscriptionCount,
    recentBootstrapCount,
    recentSubscriptionDispatchCount,
  };
};

export const createDay1NewsletterDispatcher = ({
  db,
  sendEvent,
  config,
  now = () => new Date(),
}: CreateDay1DispatcherDeps): Day1Dispatcher => {
  return async ({ userTickerId }) => {
    const subscription = await findActiveSubscription(db, userTickerId);
    if (!subscription) {
      return { status: "not_active" };
    }
    const decidedAt = now();
    const { dispatchId, decision } = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscription.tickerId}))`;
      const state = await loadDispatchState(
        tx,
        subscription,
        config.bootstrapDedupeMinutes,
        decidedAt,
      );
      const decided = decideDay1Dispatch(
        state,
        config.latestIssueMaxAgeHours,
        decidedAt,
      );
      const isSkip = decided.kind === "none";
      const dispatch = await tx.day1NewsletterDispatch.create({
        data: {
          userTickerId: subscription.id,
          tickerId: subscription.tickerId,
          language: subscription.language,
          kind: decided.kind,
          status: isSkip ? "skipped" : "dispatching",
          reason: decided.kind === "none" ? decided.reason : null,
        },
        select: { id: true },
      });

      return { dispatchId: dispatch.id, decision: decided };
    });
    if (decision.kind === "none") {
      return { status: "skipped", dispatchId, reason: decision.reason };
    }
    const event =
      decision.kind === "bootstrap"
        ? DAY1_FULL_CHAIN_EVENT
        : DAY1_LATEST_ISSUE_EVENT;
    try {
      const { executionIds } = await sendEvent({
        event,
        params: { tickerId: subscription.tickerId },
        requestId: `day1:${subscription.id}:${dispatchId}`,
      });
      const [executionId] = executionIds;
      if (executionId === undefined) {
        await db.day1NewsletterDispatch.update({
          where: { id: dispatchId },
          data: { status: "skipped", reason: "not_configured" },
        });

        return { status: "skipped", dispatchId, reason: "not_configured" };
      }
      await db.day1NewsletterDispatch.update({
        where: { id: dispatchId },
        data: { status: "fired", hermesExecutionId: executionId },
      });

      return { status: "fired", dispatchId, kind: decision.kind, executionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.day1NewsletterDispatch.update({
        where: { id: dispatchId },
        data: {
          status: "failed",
          error: message.slice(0, MAX_STORED_ERROR_LENGTH),
        },
      });

      return {
        status: "failed",
        dispatchId,
        kind: decision.kind,
        error: message,
      };
    }
  };
};

import type { Prisma, PrismaClient } from "@mediapulse/database";

import type { SendHermesDomainEvent } from "./hermes-domain-event-client.js";
import { countSubscriberTickerDeliveries } from "./subscriber-ticker-deliveries.js";

export const DEFAULT_DAY1_TRIGGER_TIMEOUT_MS = 5_000;
export const DEFAULT_DAY1_LATEST_ISSUE_MAX_AGE_HOURS = 36;
export const DEFAULT_DAY1_BOOTSTRAP_DEDUPE_MINUTES = 120;

export const DAY1_FULL_CHAIN_EVENT = "day1.full-chain";
export const DAY1_WELCOME_EVENT = "day1.welcome";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const MAX_STORED_ERROR_LENGTH = 500;

export type Day1Language = "en" | "id";

export type Day1SkipReason =
  | "already_dispatched"
  | "not_configured"
  | "returning_subscriber"
  | "bootstrap_in_flight";

export type Day1DispatchDecision =
  | { kind: "bootstrap" }
  | { kind: "welcome" }
  | { kind: "none"; reason: Day1SkipReason };

export type Day1DispatchState = {
  latestIssueCreatedAt: Date | null;
  subscriberDeliveryCount: number;
  otherActiveSubscriptionCount: number;
  recentBootstrapCount: number;
  inFlightBootstrapExecutionId: string | null;
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
      kind: "bootstrap" | "welcome";
      executionId: string;
    }
  | {
      status: "failed";
      dispatchId: string;
      kind: "bootstrap" | "welcome";
      error: string;
    };

export type Day1Dispatcher = (
  activation: Day1Activation,
) => Promise<Day1DispatchOutcome>;

export type Day1DispatcherDb = Pick<
  PrismaClient,
  | "$transaction"
  | "userTicker"
  | "day1NewsletterDispatch"
  | "newsletterDeliveryCheckpoint"
>;

export type CreateDay1DispatcherDeps = {
  db: Day1DispatcherDb;
  sendEvent: SendHermesDomainEvent;
  config: Day1DispatcherConfig;
  now?: () => Date;
};

type ActiveSubscription = {
  id: string;
  userId: string;
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
  if (state.recentBootstrapCount > 0) {
    return skip("bootstrap_in_flight");
  }
  const { latestIssueCreatedAt } = state;
  if (latestIssueCreatedAt === null) {
    return { kind: "bootstrap" };
  }
  const issueAgeMs = now.getTime() - latestIssueCreatedAt.getTime();
  const isFresh = issueAgeMs <= latestIssueMaxAgeHours * HOUR_MS;
  const isTracked = isFresh || state.otherActiveSubscriptionCount > 0;
  if (isTracked) {
    return state.subscriberDeliveryCount > 0
      ? skip("returning_subscriber")
      : { kind: "welcome" };
  }

  return { kind: "bootstrap" };
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
      userId: true,
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
    userId: subscription.userId,
    tickerId: subscription.tickerId,
    language: subscription.language,
  };
};

const loadDispatchState = async (
  tx: Prisma.TransactionClient,
  subscription: ActiveSubscription,
  subscriberDeliveryCount: number,
  bootstrapDedupeMinutes: number,
  now: Date,
): Promise<Day1DispatchState> => {
  const latestNewsletter = await tx.newsletter.findFirst({
    where: { tickerId: subscription.tickerId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const otherActiveSubscriptionCount = await tx.userTicker.count({
    where: {
      tickerId: subscription.tickerId,
      userId: { not: subscription.userId },
      enabled: true,
      registrationConfirmedAt: { not: null },
      user: { enabled: true },
    },
  });
  const dedupeSince = new Date(
    now.getTime() - bootstrapDedupeMinutes * MINUTE_MS,
  );
  const recentBootstraps = await tx.day1NewsletterDispatch.findMany({
    where: {
      tickerId: subscription.tickerId,
      kind: "bootstrap",
      status: { in: ["dispatching", "fired"] },
      createdAt: { gte: dedupeSince },
    },
    orderBy: { createdAt: "desc" },
    select: { hermesExecutionId: true },
  });
  const inFlightBootstrap = recentBootstraps.find(
    (bootstrap) => bootstrap.hermesExecutionId !== null,
  );
  const recentSubscriptionDispatchCount = await tx.day1NewsletterDispatch.count(
    {
      where: {
        userTickerId: subscription.id,
        status: { in: ["dispatching", "fired"] },
        createdAt: { gte: dedupeSince },
      },
    },
  );
  return {
    latestIssueCreatedAt: latestNewsletter?.createdAt ?? null,
    subscriberDeliveryCount,
    otherActiveSubscriptionCount,
    recentBootstrapCount: recentBootstraps.length,
    inFlightBootstrapExecutionId: inFlightBootstrap?.hermesExecutionId ?? null,
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
    const subscriberDeliveryCount = await countSubscriberTickerDeliveries(db, {
      userId: subscription.userId,
      tickerId: subscription.tickerId,
    });
    const decidedAt = now();
    const { dispatchId, decision } = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subscription.tickerId}))`;
      const state = await loadDispatchState(
        tx,
        subscription,
        subscriberDeliveryCount,
        config.bootstrapDedupeMinutes,
        decidedAt,
      );
      const decided = decideDay1Dispatch(
        state,
        config.latestIssueMaxAgeHours,
        decidedAt,
      );
      const isSkip = decided.kind === "none";
      const joinsInFlightBootstrap =
        decided.kind === "none" && decided.reason === "bootstrap_in_flight";
      const dispatch = await tx.day1NewsletterDispatch.create({
        data: {
          userTickerId: subscription.id,
          tickerId: subscription.tickerId,
          language: subscription.language,
          kind: decided.kind,
          status: isSkip ? "skipped" : "dispatching",
          reason: decided.kind === "none" ? decided.reason : null,
          hermesExecutionId: joinsInFlightBootstrap
            ? state.inFlightBootstrapExecutionId
            : null,
        },
        select: { id: true },
      });

      return { dispatchId: dispatch.id, decision: decided };
    });
    if (decision.kind === "none") {
      return { status: "skipped", dispatchId, reason: decision.reason };
    }
    const isBootstrap = decision.kind === "bootstrap";
    const event = isBootstrap ? DAY1_FULL_CHAIN_EVENT : DAY1_WELCOME_EVENT;
    const params: Record<string, string> = isBootstrap
      ? { tickerId: subscription.tickerId }
      : { tickerId: subscription.tickerId, day1DispatchId: dispatchId };
    try {
      const { executionIds } = await sendEvent({
        event,
        params,
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

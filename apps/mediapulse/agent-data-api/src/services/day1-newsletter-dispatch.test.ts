/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  createDay1NewsletterDispatcher,
  decideDay1Dispatch,
  readDay1DispatcherConfig,
  type Day1DispatchState,
  type Day1DispatcherConfig,
} from "./day1-newsletter-dispatch.js";

const NOW = new Date("2026-09-29T08:00:00.000Z");
const HOUR_MS = 3_600_000;

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS);

const baseState = (
  overrides: Partial<Day1DispatchState> = {},
): Day1DispatchState => ({
  latestIssueCreatedAt: null,
  subscriberDeliveryCount: 0,
  otherActiveSubscriptionCount: 0,
  recentBootstrapCount: 0,
  inFlightBootstrapExecutionId: null,
  recentSubscriptionDispatchCount: 0,
  ...overrides,
});

describe("decideDay1Dispatch", () => {
  it.each([
    ["no issue yet", baseState(), { kind: "bootstrap" }],
    [
      "no issue and a bootstrap already running",
      baseState({ recentBootstrapCount: 1 }),
      { kind: "none", reason: "bootstrap_in_flight" },
    ],
    [
      "a tracked ticker while a bootstrap is still running",
      baseState({
        latestIssueCreatedAt: hoursAgo(1),
        otherActiveSubscriptionCount: 1,
        recentBootstrapCount: 1,
      }),
      { kind: "none", reason: "bootstrap_in_flight" },
    ],
    [
      "no issue yet, even with other subscribers",
      baseState({ otherActiveSubscriptionCount: 3 }),
      { kind: "bootstrap" },
    ],
    [
      "a fresh issue",
      baseState({ latestIssueCreatedAt: hoursAgo(5) }),
      { kind: "welcome" },
    ],
    [
      "an issue exactly at the age limit",
      baseState({ latestIssueCreatedAt: hoursAgo(36) }),
      { kind: "welcome" },
    ],
    [
      "a stale issue while other subscribers are active",
      baseState({
        latestIssueCreatedAt: hoursAgo(40),
        otherActiveSubscriptionCount: 2,
      }),
      { kind: "welcome" },
    ],
    [
      "a returning subscriber on a tracked ticker",
      baseState({
        latestIssueCreatedAt: hoursAgo(5),
        subscriberDeliveryCount: 12,
      }),
      { kind: "none", reason: "returning_subscriber" },
    ],
    [
      "a stale issue on a lapsed ticker",
      baseState({ latestIssueCreatedAt: hoursAgo(400) }),
      { kind: "bootstrap" },
    ],
    [
      "a returning subscriber on a lapsed ticker",
      baseState({
        latestIssueCreatedAt: hoursAgo(400),
        subscriberDeliveryCount: 12,
      }),
      { kind: "bootstrap" },
    ],
    [
      "a stale issue on a lapsed ticker with a bootstrap running",
      baseState({
        latestIssueCreatedAt: hoursAgo(400),
        recentBootstrapCount: 1,
      }),
      { kind: "none", reason: "bootstrap_in_flight" },
    ],
    [
      "a subscription that was already dispatched recently",
      baseState({
        latestIssueCreatedAt: hoursAgo(5),
        recentSubscriptionDispatchCount: 1,
      }),
      { kind: "none", reason: "already_dispatched" },
    ],
  ])("decides for %s", (_label, state, expected) => {
    expect(decideDay1Dispatch(state, 36, NOW)).toEqual(expected);
  });
});

describe("readDay1DispatcherConfig", () => {
  it("applies defaults when the settings are unset or not positive", () => {
    expect(
      readDay1DispatcherConfig({ MEDIAPULSE_DAY1_TRIGGER_TIMEOUT_MS: 0 }),
    ).toEqual({
      eventTimeoutMs: 5_000,
      latestIssueMaxAgeHours: 36,
      bootstrapDedupeMinutes: 120,
    });
  });

  it("uses configured settings", () => {
    expect(
      readDay1DispatcherConfig({
        MEDIAPULSE_DAY1_TRIGGER_TIMEOUT_MS: 2_000,
        MEDIAPULSE_DAY1_LATEST_ISSUE_MAX_AGE_HOURS: 24,
        MEDIAPULSE_DAY1_BOOTSTRAP_DEDUPE_MINUTES: 30,
      }),
    ).toEqual({
      eventTimeoutMs: 2_000,
      latestIssueMaxAgeHours: 24,
      bootstrapDedupeMinutes: 30,
    });
  });
});

const CONFIG: Day1DispatcherConfig = {
  eventTimeoutMs: 5_000,
  latestIssueMaxAgeHours: 36,
  bootstrapDedupeMinutes: 120,
};

type FakeDbOptions = {
  subscription?: unknown;
  latestNewsletter?: unknown;
  otherActiveSubscriptionCount?: number;
  recentBootstraps?: { hermesExecutionId: string | null }[];
  recentSubscriptionDispatchCount?: number;
  subscriberDeliveryCount?: number;
  subscriberWelcomeCount?: number;
};

const activeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: "ut-1",
  userId: "user-1",
  tickerId: "ticker-1",
  language: "en",
  enabled: true,
  registrationConfirmedAt: hoursAgo(1),
  user: { enabled: true },
  ...overrides,
});

const buildDb = ({
  subscription = activeSubscription(),
  latestNewsletter = null,
  otherActiveSubscriptionCount = 0,
  recentBootstraps = [],
  recentSubscriptionDispatchCount = 0,
  subscriberDeliveryCount = 0,
  subscriberWelcomeCount = 0,
}: FakeDbOptions = {}) => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    newsletter: { findFirst: vi.fn().mockResolvedValue(latestNewsletter) },
    userTicker: {
      count: vi.fn().mockResolvedValue(otherActiveSubscriptionCount),
    },
    day1NewsletterDispatch: {
      findMany: vi.fn().mockResolvedValue(recentBootstraps),
      count: vi.fn().mockResolvedValue(recentSubscriptionDispatchCount),
      create: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
    },
  };
  const db = {
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
    userTicker: { findUnique: vi.fn().mockResolvedValue(subscription) },
    day1NewsletterDispatch: {
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(subscriberWelcomeCount),
    },
    newsletterDeliveryCheckpoint: {
      count: vi.fn().mockResolvedValue(subscriberDeliveryCount),
    },
  };

  return { db, tx };
};

describe("createDay1NewsletterDispatcher", () => {
  it("does nothing for a subscription that is not active", async () => {
    const { db } = buildDb({
      subscription: activeSubscription({ user: { enabled: false } }),
    });
    const sendEvent = vi.fn();
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({ status: "not_active" });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("fires the bootstrap trigger for a ticker without any issue", async () => {
    const { db, tx } = buildDb();
    const sendEvent = vi.fn().mockResolvedValue({ executionIds: ["exec-9"] });
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "fired",
      dispatchId: "dispatch-1",
      kind: "bootstrap",
      executionId: "exec-9",
    });
    expect(tx.$executeRaw.mock.calls[0]?.[1]).toBe("ticker-1");
    expect(tx.day1NewsletterDispatch.findMany).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        kind: "bootstrap",
        status: { in: ["dispatching", "fired"] },
        createdAt: { gte: new Date(NOW.getTime() - 120 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
      select: { hermesExecutionId: true },
    });
    expect(tx.day1NewsletterDispatch.create).toHaveBeenCalledWith({
      data: {
        userTickerId: "ut-1",
        tickerId: "ticker-1",
        language: "en",
        kind: "bootstrap",
        status: "dispatching",
        reason: null,
        hermesExecutionId: null,
      },
      select: { id: true },
    });
    expect(sendEvent).toHaveBeenCalledWith({
      event: "day1.full-chain",
      params: { tickerId: "ticker-1" },
      requestId: "day1:ut-1:dispatch-1",
    });
    expect(db.day1NewsletterDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
      data: { status: "fired", hermesExecutionId: "exec-9" },
    });
  });

  it("fires the welcome trigger with the dispatch id when the ticker is tracked", async () => {
    const { db, tx } = buildDb({
      subscription: activeSubscription({ language: "id" }),
      latestNewsletter: { createdAt: hoursAgo(3) },
    });
    const sendEvent = vi.fn().mockResolvedValue({ executionIds: ["exec-4"] });
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "fired",
      dispatchId: "dispatch-1",
      kind: "welcome",
      executionId: "exec-4",
    });
    expect(tx.newsletter.findFirst).toHaveBeenCalledWith({
      where: { tickerId: "ticker-1" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    expect(tx.day1NewsletterDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "welcome",
        status: "dispatching",
        language: "id",
      }),
      select: { id: true },
    });
    expect(sendEvent).toHaveBeenCalledWith({
      event: "day1.welcome",
      params: { tickerId: "ticker-1", day1DispatchId: "dispatch-1" },
      requestId: "day1:ut-1:dispatch-1",
    });
  });

  it("skips a returning subscriber of a tracked ticker without calling Hermes", async () => {
    const { db, tx } = buildDb({
      latestNewsletter: { createdAt: hoursAgo(3) },
      subscriberDeliveryCount: 4,
    });
    const sendEvent = vi.fn();
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "skipped",
      dispatchId: "dispatch-1",
      reason: "returning_subscriber",
    });
    expect(db.newsletterDeliveryCheckpoint.count).toHaveBeenCalledWith({
      where: {
        resendEmailId: { not: null },
        userTicker: { userId: "user-1", tickerId: "ticker-1" },
      },
    });
    expect(tx.day1NewsletterDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "none",
        status: "skipped",
        reason: "returning_subscriber",
      }),
      select: { id: true },
    });
    expect(sendEvent).not.toHaveBeenCalled();
    expect(db.day1NewsletterDispatch.update).not.toHaveBeenCalled();
  });

  it("marks the dispatch failed and does not throw when Hermes rejects the call", async () => {
    const { db } = buildDb();
    const sendEvent = vi
      .fn()
      .mockRejectedValue(
        new Error("Hermes answered 401 to event day1.full-chain"),
      );
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "failed",
      dispatchId: "dispatch-1",
      kind: "bootstrap",
      error: "Hermes answered 401 to event day1.full-chain",
    });
    expect(db.day1NewsletterDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
      data: {
        status: "failed",
        error: "Hermes answered 401 to event day1.full-chain",
      },
    });
  });

  it("skips a subscription that already has a recent dispatch", async () => {
    const { db, tx } = buildDb({ recentSubscriptionDispatchCount: 1 });
    const sendEvent = vi.fn();
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toMatchObject({
      status: "skipped",
      reason: "already_dispatched",
    });
    expect(tx.day1NewsletterDispatch.count).toHaveBeenLastCalledWith({
      where: {
        userTickerId: "ut-1",
        status: { in: ["dispatching", "fired"] },
        createdAt: { gte: new Date(NOW.getTime() - 120 * 60_000) },
      },
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("links a signup that waits on a running bootstrap to that run's execution", async () => {
    const { db, tx } = buildDb({
      recentBootstraps: [
        { hermesExecutionId: null },
        { hermesExecutionId: "exec-7" },
        { hermesExecutionId: "exec-3" },
      ],
    });
    const sendEvent = vi.fn();
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "skipped",
      dispatchId: "dispatch-1",
      reason: "bootstrap_in_flight",
    });
    expect(tx.day1NewsletterDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "none",
        status: "skipped",
        reason: "bootstrap_in_flight",
        hermesExecutionId: "exec-7",
      }),
      select: { id: true },
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("leaves a waiting signup unlinked while the running bootstrap has no execution yet", async () => {
    const { db, tx } = buildDb({
      recentBootstraps: [{ hermesExecutionId: null }],
    });
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent: vi.fn(),
      config: CONFIG,
      now: () => NOW,
    });

    await dispatch({ userTickerId: "ut-1" });

    expect(tx.day1NewsletterDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: "bootstrap_in_flight",
        hermesExecutionId: null,
      }),
      select: { id: true },
    });
  });

  it("records not configured when no Hermes trigger listens for the event", async () => {
    const { db } = buildDb();
    const sendEvent = vi.fn().mockResolvedValue({ executionIds: [] });
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "skipped",
      dispatchId: "dispatch-1",
      reason: "not_configured",
    });
    expect(db.day1NewsletterDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
      data: { status: "skipped", reason: "not_configured" },
    });
  });

  it("does not welcome a subscriber twice for the same ticker", async () => {
    const { db } = buildDb({
      latestNewsletter: { createdAt: hoursAgo(3) },
      subscriberWelcomeCount: 1,
    });
    const sendEvent = vi.fn();
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toMatchObject({
      status: "skipped",
      reason: "returning_subscriber",
    });
    expect(db.day1NewsletterDispatch.count).toHaveBeenCalledWith({
      where: {
        welcomeClaimedAt: { not: null },
        userTicker: { userId: "user-1", tickerId: "ticker-1" },
      },
    });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("welcomes a signup on a stale ticker that other people still follow", async () => {
    const { db, tx } = buildDb({
      latestNewsletter: { createdAt: hoursAgo(100) },
      otherActiveSubscriptionCount: 1,
    });
    const sendEvent = vi.fn().mockResolvedValue({ executionIds: [] });
    const dispatch = createDay1NewsletterDispatcher({
      db: db as never,
      sendEvent,
      config: CONFIG,
      now: () => NOW,
    });

    const outcome = await dispatch({ userTickerId: "ut-1" });

    expect(outcome).toEqual({
      status: "skipped",
      dispatchId: "dispatch-1",
      reason: "not_configured",
    });
    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "day1.welcome" }),
    );
    expect(tx.userTicker.count).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        userId: { not: "user-1" },
        enabled: true,
        registrationConfirmedAt: { not: null },
        user: { enabled: true },
      },
    });
  });
});

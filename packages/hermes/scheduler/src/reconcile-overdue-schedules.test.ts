/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  planScheduleRecovery,
  reconcileOverdueSchedules,
  type ReconcileLogger,
  type ReconcileOverdueSchedulesDeps,
  type ReconcileSchedulesDb,
  type ScheduleForRecovery,
} from "./reconcile-overdue-schedules";

// ─── planScheduleRecovery ─────────────────────────────────────────────────────

const BASE_SCHEDULE: ScheduleForRecovery = {
  id: "s1",
  enabled: true,
  repeat: "repeating",
  cronExpression: null,
  interval: 60_000,
  timezone: "UTC",
  nextRunAt: new Date("2024-01-01T00:00:00Z"),
};

const GRACE_MS = 900_000; // 15 minutes

describe("planScheduleRecovery", () => {
  it("returns skip-forward for an overdue interval schedule beyond grace", () => {
    const now = new Date("2024-01-01T01:00:00Z"); // 1 hour overdue

    const result = planScheduleRecovery(BASE_SCHEDULE, now, GRACE_MS);

    expect(result.action).toBe("skip-forward");
    if (result.action !== "skip-forward") return;
    expect(result.newNextRunAt.getTime()).toBeGreaterThan(now.getTime());
    expect(result.missedOccurrences).toBeGreaterThan(1);
  });

  it("computes missedOccurrences correctly for interval schedule", () => {
    const now = new Date("2024-01-01T01:00:00Z"); // exactly 60 minutes overdue, interval = 1 minute
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      interval: 60_000,
      nextRunAt: new Date("2024-01-01T00:00:00Z"),
    };

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("skip-forward");
    if (result.action !== "skip-forward") return;
    expect(result.missedOccurrences).toBe(60);
  });

  it("returns skip-forward for an overdue cron schedule beyond grace", () => {
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      cronExpression: "* * * * *", // every minute
      interval: null,
      nextRunAt: new Date("2024-01-01T00:00:00Z"),
    };
    const now = new Date("2024-01-01T01:00:00Z"); // 60 minutes overdue

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("skip-forward");
    if (result.action !== "skip-forward") return;
    expect(result.newNextRunAt.getTime()).toBeGreaterThan(now.getTime());
    expect(result.missedOccurrences).toBeGreaterThanOrEqual(59);
  });

  it("returns leave when overdue by less than grace window", () => {
    const now = new Date("2024-01-01T00:10:00Z"); // 10 minutes overdue, grace = 15 min

    const result = planScheduleRecovery(BASE_SCHEDULE, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("returns leave when overdue by exactly grace window", () => {
    const now = new Date(BASE_SCHEDULE.nextRunAt!.getTime() + GRACE_MS);

    const result = planScheduleRecovery(BASE_SCHEDULE, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("returns leave for a once schedule", () => {
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      repeat: "once",
    };
    const now = new Date("2024-01-01T02:00:00Z");

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("returns leave for a disabled schedule", () => {
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      enabled: false,
    };
    const now = new Date("2024-01-01T02:00:00Z");

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("returns leave when nextRunAt is null", () => {
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      nextRunAt: null,
    };
    const now = new Date("2024-01-01T02:00:00Z");

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("returns leave when computeNextRunAt returns null (invalid cron)", () => {
    const schedule: ScheduleForRecovery = {
      ...BASE_SCHEDULE,
      cronExpression: "not-a-valid-cron",
      interval: null,
    };
    const now = new Date("2024-01-01T02:00:00Z");

    const result = planScheduleRecovery(schedule, now, GRACE_MS);

    expect(result.action).toBe("leave");
  });

  it("never returns a null or past newNextRunAt for a valid schedule", () => {
    const now = new Date("2024-01-01T02:00:00Z");

    const result = planScheduleRecovery(BASE_SCHEDULE, now, GRACE_MS);

    expect(result.action).toBe("skip-forward");
    if (result.action !== "skip-forward") return;
    expect(result.newNextRunAt.getTime()).toBeGreaterThan(now.getTime());
  });
});

// ─── reconcileOverdueSchedules ────────────────────────────────────────────────

const makeScheduleRow = (
  overrides: Partial<ScheduleForRecovery> = {},
): ScheduleForRecovery => ({
  id: "s1",
  enabled: true,
  repeat: "repeating",
  cronExpression: null,
  interval: 60_000,
  timezone: "UTC",
  nextRunAt: new Date(Date.now() - 2 * 60 * 60 * 1_000), // 2 hours ago
  ...overrides,
});

const makeLogger = (): ReconcileLogger => ({
  info: vi.fn(),
  warn: vi.fn(),
});

const makeDeps = (
  schedules: ScheduleForRecovery[],
  overrides: Partial<ReconcileOverdueSchedulesDeps> = {},
): ReconcileOverdueSchedulesDeps => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const db = {
    schedule: {
      findMany: vi.fn().mockResolvedValue(schedules),
      update: mockUpdate,
    },
  } as unknown as ReconcileSchedulesDb;

  return {
    db,
    logger: makeLogger(),
    graceMs: GRACE_MS,
    ...overrides,
  };
};

describe("reconcileOverdueSchedules", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero counts when no schedules are overdue", async () => {
    const deps = makeDeps([]);

    const result = await reconcileOverdueSchedules(deps);

    expect(result).toEqual({ reconciledCount: 0, totalMissed: 0 });
  });

  it("queries only enabled repeating schedules with nextRunAt before the threshold", async () => {
    const deps = makeDeps([]);
    const before = Date.now();

    await reconcileOverdueSchedules(deps);

    const after = Date.now();
    const findManyCall = vi.mocked(
      (
        deps.db as unknown as {
          schedule: { findMany: ReturnType<typeof vi.fn> };
        }
      ).schedule.findMany,
    ).mock.calls[0];
    expect(findManyCall).toBeDefined();
    const where = findManyCall![0].where as {
      enabled: boolean;
      repeat: string;
      nextRunAt: { lt: Date };
    };
    expect(where.enabled).toBe(true);
    expect(where.repeat).toBe("repeating");
    const threshold = where.nextRunAt.lt.getTime();
    expect(threshold).toBeGreaterThanOrEqual(before - GRACE_MS - 50);
    expect(threshold).toBeLessThanOrEqual(after - GRACE_MS + 50);
  });

  it("updates nextRunAt, lastRecoveredAt, and lastMissedRunCount for overdue schedules", async () => {
    const schedule = makeScheduleRow();
    const deps = makeDeps([schedule]);

    await reconcileOverdueSchedules(deps);

    const updateMock = vi.mocked(
      (deps.db as unknown as { schedule: { update: ReturnType<typeof vi.fn> } })
        .schedule.update,
    );
    expect(updateMock).toHaveBeenCalledTimes(1);
    const updateCall = updateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: {
        nextRunAt: Date;
        lastRecoveredAt: Date;
        lastMissedRunCount: number;
      };
    };
    expect(updateCall.where.id).toBe("s1");
    expect(updateCall.data.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    expect(updateCall.data.lastRecoveredAt).toBeInstanceOf(Date);
    expect(updateCall.data.lastMissedRunCount).toBeGreaterThan(0);
  });

  it("returns correct reconciledCount and totalMissed for multiple schedules", async () => {
    const s1 = makeScheduleRow({ id: "s1", interval: 60_000 });
    const s2 = makeScheduleRow({ id: "s2", interval: 120_000 });
    const deps = makeDeps([s1, s2]);

    const result = await reconcileOverdueSchedules(deps);

    expect(result.reconciledCount).toBe(2);
    expect(result.totalMissed).toBeGreaterThan(0);
  });

  it("does not call schedule.update for a once schedule", async () => {
    const schedule = makeScheduleRow({ repeat: "once" });
    const deps = makeDeps([schedule]);

    await reconcileOverdueSchedules(deps);

    const updateMock = vi.mocked(
      (deps.db as unknown as { schedule: { update: ReturnType<typeof vi.fn> } })
        .schedule.update,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not call schedule.update for a disabled schedule", async () => {
    const schedule = makeScheduleRow({ enabled: false });
    const deps = makeDeps([schedule]);

    await reconcileOverdueSchedules(deps);

    const updateMock = vi.mocked(
      (deps.db as unknown as { schedule: { update: ReturnType<typeof vi.fn> } })
        .schedule.update,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not call schedule.update when nextRunAt is within grace", async () => {
    const schedule = makeScheduleRow({
      nextRunAt: new Date(Date.now() - 5 * 60 * 1_000), // 5 min ago, within 15-min grace
    });
    const deps = makeDeps([schedule]);

    await reconcileOverdueSchedules(deps);

    const updateMock = vi.mocked(
      (deps.db as unknown as { schedule: { update: ReturnType<typeof vi.fn> } })
        .schedule.update,
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("emits a structured log line for each reconciled schedule", async () => {
    const schedule = makeScheduleRow();
    const deps = makeDeps([schedule]);

    await reconcileOverdueSchedules(deps);

    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "s1",
        previousNextRunAt: schedule.nextRunAt,
        newNextRunAt: expect.any(Date),
        missedOccurrences: expect.any(Number),
        reason: "downtime-recovery",
      }),
      "schedule_recovery: rolled stale schedule forward",
    );
  });

  it("uses default graceMs of 900000 when not provided", async () => {
    const deps: ReconcileOverdueSchedulesDeps = {
      db: {
        schedule: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
        },
      } as unknown as ReconcileSchedulesDb,
      logger: makeLogger(),
    };
    const before = Date.now();

    await reconcileOverdueSchedules(deps);

    const after = Date.now();
    const findManyCall = vi.mocked(
      (
        deps.db as unknown as {
          schedule: { findMany: ReturnType<typeof vi.fn> };
        }
      ).schedule.findMany,
    ).mock.calls[0];
    const threshold = (
      findManyCall![0].where as { nextRunAt: { lt: Date } }
    ).nextRunAt.lt.getTime();
    expect(threshold).toBeGreaterThanOrEqual(before - 900_000 - 50);
    expect(threshold).toBeLessThanOrEqual(after - 900_000 + 50);
  });
});

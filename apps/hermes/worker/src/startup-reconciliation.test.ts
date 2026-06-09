/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockReconcileOverdueSchedules = vi.hoisted(() => vi.fn());

vi.mock("@hermes/scheduler", () => ({
  reconcileOverdueSchedules: mockReconcileOverdueSchedules,
}));

import {
  runStartupReconciliation,
  type StartupReconciliationDeps,
} from "./startup-reconciliation";

const makeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const makeDeps = (): StartupReconciliationDeps => ({
  db: {} as StartupReconciliationDeps["db"],
  logger: makeLogger(),
  graceMs: 900_000,
});

describe("runStartupReconciliation", () => {
  beforeEach(() => {
    mockReconcileOverdueSchedules.mockReset();
  });

  it("calls reconcileOverdueSchedules with the provided deps", async () => {
    mockReconcileOverdueSchedules.mockResolvedValue({
      reconciledCount: 3,
      totalMissed: 15,
    });
    const deps = makeDeps();

    await runStartupReconciliation(deps);

    expect(mockReconcileOverdueSchedules).toHaveBeenCalledTimes(1);
    expect(mockReconcileOverdueSchedules).toHaveBeenCalledWith({
      db: deps.db,
      logger: deps.logger,
      graceMs: 900_000,
    });
  });

  it("logs the reconciliation summary on success", async () => {
    mockReconcileOverdueSchedules.mockResolvedValue({
      reconciledCount: 2,
      totalMissed: 10,
    });
    const deps = makeDeps();

    await runStartupReconciliation(deps);

    expect(deps.logger.info).toHaveBeenCalledWith(
      { reconciledCount: 2, totalMissed: 10 },
      "schedule_recovery: startup reconciliation complete",
    );
  });

  it("catches a thrown error and logs it without rethrowing", async () => {
    const boom = new Error("db connection refused");
    mockReconcileOverdueSchedules.mockRejectedValue(boom);
    const deps = makeDeps();

    await expect(runStartupReconciliation(deps)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      { err: boom },
      "schedule_recovery: startup reconciliation failed, continuing",
    );
  });

  it("does not log success when reconciliation throws", async () => {
    mockReconcileOverdueSchedules.mockRejectedValue(new Error("fail"));
    const deps = makeDeps();

    await runStartupReconciliation(deps);

    expect(deps.logger.info).not.toHaveBeenCalled();
  });
});

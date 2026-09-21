/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import {
  cleanUpOneShotRun,
  createOneShotRun,
  ONE_SHOT_NAME_PREFIX,
  parkOneShotRun,
  waitForExtractionRun,
  type ExtractionRunRow,
} from "./run-extraction-once";
import { AGENT_ID, AGENT_VERSION } from "./seed-knowledge-extraction-schedule";

const buildDb = (overrides: { integration?: { id: string } | null } = {}) => {
  const db = {
    domainIntegration: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides.integration === undefined
            ? { id: "integration-1" }
            : overrides.integration,
        ),
    },
    agentConfig: {
      create: vi.fn().mockResolvedValue({ id: "config-one-shot" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    pipeline: {
      create: vi.fn().mockResolvedValue({ id: "pipeline-one-shot" }),
      delete: vi.fn().mockResolvedValue({ id: "pipeline-one-shot" }),
    },
    schedule: {
      create: vi.fn().mockResolvedValue({ id: "schedule-one-shot" }),
      update: vi.fn().mockResolvedValue({ id: "schedule-one-shot" }),
    },
  };

  return db as unknown as Pick<
    PrismaClientWithSchema,
    "domainIntegration" | "agentConfig" | "pipeline" | "schedule"
  > &
    typeof db;
};

const run = (overrides: Partial<ExtractionRunRow> = {}): ExtractionRunRow => ({
  id: "run-1",
  status: "success",
  considered: 30,
  entitiesCreated: 12,
  relationsOpened: 9,
  relationsConfirmed: 3,
  mentionsWritten: 40,
  kindsCreated: 2,
  rejectedSpanNotInText: 4,
  rejectedNameNotInText: 0,
  stopReason: null,
  durationMs: 61_000,
  ...overrides,
});

describe("createOneShotRun", () => {
  it("creates its own pipeline, step and config rather than touching the nightly ones", async () => {
    const db = buildDb();

    const ids = await createOneShotRun(db as never, {
      tickerId: "ticker-1",
      symbol: "FORE",
      limit: 30,
    });

    expect(ids).toStrictEqual({
      pipelineId: "pipeline-one-shot",
      scheduleId: "schedule-one-shot",
    });
    expect(db.pipeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: `${ONE_SHOT_NAME_PREFIX} (FORE)`,
          steps: {
            create: [
              expect.objectContaining({
                agentId: AGENT_ID,
                agentVersion: AGENT_VERSION,
                agentConfigId: "config-one-shot",
                input: { tickerId: "ticker-1", limit: 30 },
              }),
            ],
          },
        }),
      }),
    );
  });

  it("makes the schedule due so the worker's next check picks it up", async () => {
    const db = buildDb();

    await createOneShotRun(db as never, {
      tickerId: "ticker-1",
      symbol: "FORE",
      limit: 30,
    });

    const data = db.schedule.create.mock.calls[0]?.[0]?.data as {
      nextRunAt: Date;
      enabled: boolean;
      pipelineId: string;
    };

    expect(data.enabled).toBe(true);
    expect(data.nextRunAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(data.pipelineId).toBe("pipeline-one-shot");
  });

  it("refuses when the orchestration database has no domain integration", async () => {
    const db = buildDb({ integration: null });

    await expect(
      createOneShotRun(db as never, {
        tickerId: "ticker-1",
        symbol: "FORE",
        limit: 30,
      }),
    ).rejects.toThrow(/domain integration/u);
    expect(db.pipeline.create).not.toHaveBeenCalled();
  });
});

describe("cleanUpOneShotRun", () => {
  it("deletes the pipeline, which cascades, and its config", async () => {
    const db = buildDb();

    await cleanUpOneShotRun(db as never, {
      pipelineId: "pipeline-one-shot",
      symbol: "FORE",
    });

    expect(db.pipeline.delete).toHaveBeenCalledWith({
      where: { id: "pipeline-one-shot" },
    });
    expect(db.agentConfig.deleteMany).toHaveBeenCalledWith({
      where: { name: `${ONE_SHOT_NAME_PREFIX} (FORE)` },
    });
  });
});

describe("parkOneShotRun", () => {
  it("switches the schedule off without deleting rows a live job still references", async () => {
    const db = buildDb();

    await parkOneShotRun(db as never, "schedule-one-shot");

    expect(db.schedule.update).toHaveBeenCalledWith({
      where: { id: "schedule-one-shot" },
      data: { enabled: false, nextRunAt: null },
    });
    expect(db.pipeline.delete).not.toHaveBeenCalled();
    expect(db.agentConfig.deleteMany).not.toHaveBeenCalled();
  });
});

describe("waitForExtractionRun", () => {
  it("returns the run once it is no longer running", async () => {
    const findRun = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run({ status: "running" }))
      .mockResolvedValueOnce(run({ status: "success" }));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await waitForExtractionRun(findRun, 60_000, sleepFn);

    expect(result?.status).toBe("success");
    expect(findRun).toHaveBeenCalledTimes(3);
  });

  it("returns a failed run rather than waiting for a success that never comes", async () => {
    const findRun = vi.fn().mockResolvedValue(run({ status: "failed" }));

    const result = await waitForExtractionRun(
      findRun,
      60_000,
      vi.fn().mockResolvedValue(undefined),
    );

    expect(result?.status).toBe("failed");
  });

  it("gives up when the wait runs out, so cleanup still happens", async () => {
    const findRun = vi.fn().mockResolvedValue(null);
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await waitForExtractionRun(findRun, 0, sleepFn);

    expect(result).toBeNull();
  });
});

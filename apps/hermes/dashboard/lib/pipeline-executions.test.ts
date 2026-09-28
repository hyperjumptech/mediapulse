/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getPipelineExecutionsPage } from "./pipeline-executions";

const scheduleFindManyMock = vi.fn();
const httpTriggerFindManyMock = vi.fn();
const scheduleExecutionFindManyMock = vi.fn();
const scheduleExecutionCountMock = vi.fn();
const httpTriggerExecutionFindManyMock = vi.fn();
const httpTriggerExecutionCountMock = vi.fn();
const manualPipelineExecutionFindManyMock = vi.fn();
const manualPipelineExecutionCountMock = vi.fn();
const agentJobExecutionFindManyMock = vi.fn();

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    schedule: {
      findMany: (...args: unknown[]) => scheduleFindManyMock(...args),
    },
    httpTrigger: {
      findMany: (...args: unknown[]) => httpTriggerFindManyMock(...args),
    },
    scheduleExecution: {
      findMany: (...args: unknown[]) => scheduleExecutionFindManyMock(...args),
      count: (...args: unknown[]) => scheduleExecutionCountMock(...args),
    },
    httpTriggerExecution: {
      findMany: (...args: unknown[]) =>
        httpTriggerExecutionFindManyMock(...args),
      count: (...args: unknown[]) => httpTriggerExecutionCountMock(...args),
    },
    manualPipelineExecution: {
      findMany: (...args: unknown[]) =>
        manualPipelineExecutionFindManyMock(...args),
      count: (...args: unknown[]) => manualPipelineExecutionCountMock(...args),
    },
    agentJobExecution: {
      findMany: (...args: unknown[]) => agentJobExecutionFindManyMock(...args),
    },
  },
}));

const listSelect = {
  id: true,
  executionTime: true,
  enqueueStatus: true,
  runStatus: true,
  jobsCreated: true,
  jobsEnqueued: true,
  succeededInvocationCount: true,
  failedInvocationCount: true,
  createdAt: true,
};

const newestFirst = [{ executionTime: "desc" }, { id: "desc" }];

const executionRow = (id: string, executionTimeIso: string) => ({
  id,
  executionTime: new Date(executionTimeIso),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 1,
  jobsEnqueued: 1,
  succeededInvocationCount: 1,
  failedInvocationCount: 0,
  createdAt: new Date(executionTimeIso),
});

const givenPipelineSources = (options: {
  scheduleIds: string[];
  httpTriggerIds: string[];
}) => {
  scheduleFindManyMock.mockResolvedValue(
    options.scheduleIds.map((scheduleId) => ({
      id: scheduleId,
      name: `Schedule ${scheduleId}`,
    })),
  );
  httpTriggerFindManyMock.mockResolvedValue(
    options.httpTriggerIds.map((httpTriggerId) => ({
      id: httpTriggerId,
      name: `Trigger ${httpTriggerId}`,
    })),
  );
};

describe("getPipelineExecutionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    scheduleFindManyMock.mockReset();
    httpTriggerFindManyMock.mockReset();
    scheduleExecutionFindManyMock.mockReset();
    scheduleExecutionCountMock.mockReset();
    httpTriggerExecutionFindManyMock.mockReset();
    httpTriggerExecutionCountMock.mockReset();
    manualPipelineExecutionFindManyMock.mockReset();
    manualPipelineExecutionCountMock.mockReset();
    agentJobExecutionFindManyMock.mockReset();
  });

  it("merges rows across sources and sorts by execution time desc", async () => {
    // Setup
    givenPipelineSources({
      scheduleIds: ["sch-1"],
      httpTriggerIds: ["trigger-1"],
    });
    scheduleExecutionFindManyMock.mockResolvedValue([
      {
        ...executionRow("sch-exec-1", "2026-03-20T10:00:00.000Z"),
        scheduleId: "sch-1",
      },
    ]);
    scheduleExecutionCountMock.mockResolvedValue(1);
    httpTriggerExecutionFindManyMock.mockResolvedValue([
      {
        ...executionRow("http-exec-1", "2026-03-20T11:00:00.000Z"),
        runStatus: "partial",
        httpTriggerId: "trigger-1",
      },
    ]);
    httpTriggerExecutionCountMock.mockResolvedValue(1);
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      {
        ...executionRow("manual-exec-1", "2026-03-20T12:00:00.000Z"),
        runStatus: "failed",
      },
    ]);
    manualPipelineExecutionCountMock.mockResolvedValue(1);
    agentJobExecutionFindManyMock.mockResolvedValue([]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 1, 10);

    // Assert
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.executions.map((item) => item.id)).toEqual([
      "manual-exec-1",
      "http-exec-1",
      "sch-exec-1",
    ]);
    expect(result.executions.map((item) => item.source)).toEqual([
      "manual",
      "http-trigger",
      "schedule",
    ]);
    expect(result.executions.map((item) => item.sourceId)).toEqual([
      "pipe-1",
      "trigger-1",
      "sch-1",
    ]);
    expect(result.executions.map((item) => item.sourceName)).toEqual([
      null,
      "Trigger trigger-1",
      "Schedule sch-1",
    ]);
    expect(result.executions.map((item) => item.elapsedLabel)).toEqual([
      "—",
      "—",
      "—",
    ]);
    expect(result.executions[0]).not.toHaveProperty("errors");
  });

  it("applies merged pagination after sorting", async () => {
    // Setup
    givenPipelineSources({ scheduleIds: ["sch-1"], httpTriggerIds: [] });
    scheduleExecutionFindManyMock.mockResolvedValue([
      {
        ...executionRow("sch-exec-1", "2026-03-20T10:00:00.000Z"),
        scheduleId: "sch-1",
      },
    ]);
    scheduleExecutionCountMock.mockResolvedValue(1);
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      executionRow("manual-exec-1", "2026-03-20T12:00:00.000Z"),
      executionRow("manual-exec-2", "2026-03-20T11:00:00.000Z"),
    ]);
    manualPipelineExecutionCountMock.mockResolvedValue(2);
    agentJobExecutionFindManyMock.mockResolvedValue([
      {
        scheduleExecutionId: "sch-exec-1",
        httpTriggerExecutionId: null,
        manualExecutionId: null,
        enqueuedAt: new Date("2026-03-20T10:00:00.000Z"),
        startedAt: new Date("2026-03-20T10:00:05.000Z"),
        completedAt: new Date("2026-03-20T10:01:00.000Z"),
      },
    ]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 2, 2);

    // Assert
    expect(result.total).toBe(3);
    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]?.id).toBe("sch-exec-1");
    expect(result.executions[0]?.elapsedLabel).toBe("55s");
    expect(agentJobExecutionFindManyMock).toHaveBeenCalledWith({
      where: { OR: [{ scheduleExecutionId: { in: ["sch-exec-1"] } }] },
      select: {
        scheduleExecutionId: true,
        httpTriggerExecutionId: true,
        manualExecutionId: true,
        enqueuedAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
  });

  it("loads only the newest page-worth of rows per schedule and trigger by exact foreign key", async () => {
    // Setup
    givenPipelineSources({
      scheduleIds: ["sch-1", "sch-2"],
      httpTriggerIds: ["trigger-1"],
    });
    scheduleExecutionFindManyMock.mockResolvedValue([]);
    scheduleExecutionCountMock.mockResolvedValue(0);
    httpTriggerExecutionFindManyMock.mockResolvedValue([]);
    httpTriggerExecutionCountMock.mockResolvedValue(0);
    manualPipelineExecutionFindManyMock.mockResolvedValue([]);
    manualPipelineExecutionCountMock.mockResolvedValue(0);

    // Act
    await getPipelineExecutionsPage("pipe-1", 3, 10);

    // Assert
    expect(scheduleFindManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "pipe-1" },
      select: { id: true, name: true },
    });
    expect(httpTriggerFindManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "pipe-1" },
      select: { id: true, name: true },
    });
    expect(scheduleExecutionFindManyMock).toHaveBeenCalledTimes(2);
    expect(scheduleExecutionFindManyMock).toHaveBeenCalledWith({
      where: { scheduleId: "sch-1" },
      orderBy: newestFirst,
      take: 30,
      select: { ...listSelect, scheduleId: true },
    });
    expect(scheduleExecutionFindManyMock).toHaveBeenCalledWith({
      where: { scheduleId: "sch-2" },
      orderBy: newestFirst,
      take: 30,
      select: { ...listSelect, scheduleId: true },
    });
    expect(scheduleExecutionCountMock).toHaveBeenCalledWith({
      where: { scheduleId: { in: ["sch-1", "sch-2"] } },
    });
    expect(httpTriggerExecutionFindManyMock).toHaveBeenCalledWith({
      where: { httpTriggerId: "trigger-1" },
      orderBy: newestFirst,
      take: 30,
      select: { ...listSelect, httpTriggerId: true },
    });
    expect(httpTriggerExecutionCountMock).toHaveBeenCalledWith({
      where: { httpTriggerId: { in: ["trigger-1"] } },
    });
    expect(manualPipelineExecutionFindManyMock).toHaveBeenCalledWith({
      where: { pipelineId: "pipe-1" },
      orderBy: newestFirst,
      take: 30,
      select: listSelect,
    });
    expect(manualPipelineExecutionCountMock).toHaveBeenCalledWith({
      where: { pipelineId: "pipe-1" },
    });
    expect(agentJobExecutionFindManyMock).not.toHaveBeenCalled();
  });

  it("clamps the page so no source loads more than 1000 rows and still reports the full total", async () => {
    // Setup
    givenPipelineSources({ scheduleIds: ["sch-1"], httpTriggerIds: [] });
    const scheduleRows = Array.from({ length: 1000 }, (_element, index) => ({
      ...executionRow(
        `sch-exec-${String(index).padStart(4, "0")}`,
        new Date(Date.UTC(2026, 0, 1) - index * 60_000).toISOString(),
      ),
      scheduleId: "sch-1",
    }));
    scheduleExecutionFindManyMock.mockResolvedValue(scheduleRows);
    scheduleExecutionCountMock.mockResolvedValue(5000);
    manualPipelineExecutionFindManyMock.mockResolvedValue([]);
    manualPipelineExecutionCountMock.mockResolvedValue(3);
    agentJobExecutionFindManyMock.mockResolvedValue([]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 80, 20);

    // Assert
    expect(scheduleExecutionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 }),
    );
    expect(manualPipelineExecutionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 }),
    );
    expect(result.page).toBe(50);
    expect(result.total).toBe(5003);
    expect(result.executions.map((item) => item.id)).toEqual(
      scheduleRows.slice(980, 1000).map((row) => row.id),
    );
  });

  it("skips execution queries for a pipeline without schedules or triggers", async () => {
    // Setup
    givenPipelineSources({ scheduleIds: [], httpTriggerIds: [] });
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      executionRow("manual-exec-1", "2026-03-20T12:00:00.000Z"),
    ]);
    manualPipelineExecutionCountMock.mockResolvedValue(1);
    agentJobExecutionFindManyMock.mockResolvedValue([]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 1, 10);

    // Assert
    expect(scheduleExecutionFindManyMock).not.toHaveBeenCalled();
    expect(scheduleExecutionCountMock).not.toHaveBeenCalled();
    expect(httpTriggerExecutionFindManyMock).not.toHaveBeenCalled();
    expect(httpTriggerExecutionCountMock).not.toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.executions.map((item) => item.id)).toEqual(["manual-exec-1"]);
  });

  it("orders executions with the same time by id descending", async () => {
    // Setup
    givenPipelineSources({ scheduleIds: ["sch-1"], httpTriggerIds: [] });
    scheduleExecutionFindManyMock.mockResolvedValue([
      {
        ...executionRow("exec-a", "2026-03-20T10:00:00.000Z"),
        scheduleId: "sch-1",
      },
    ]);
    scheduleExecutionCountMock.mockResolvedValue(1);
    manualPipelineExecutionFindManyMock.mockResolvedValue([
      executionRow("exec-b", "2026-03-20T10:00:00.000Z"),
    ]);
    manualPipelineExecutionCountMock.mockResolvedValue(1);
    agentJobExecutionFindManyMock.mockResolvedValue([]);

    // Act
    const result = await getPipelineExecutionsPage("pipe-1", 1, 10);

    // Assert
    expect(result.executions.map((item) => item.id)).toEqual([
      "exec-b",
      "exec-a",
    ]);
  });
});

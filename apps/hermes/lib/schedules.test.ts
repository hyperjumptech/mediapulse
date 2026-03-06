/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getScheduleById, getSchedulesPage } from "./schedules";
import type { PrismaClientWithSchema } from "@workspace/database/client";

type MockDb = {
  schedule: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  schedule: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
});

/** Cast minimal mock to PrismaClientWithSchema for tests. */
const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getSchedulesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany and count with default sort and no search when options omitted", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(1, 10, undefined, asDb(db));

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { name: "asc" },
      include: { pipeline: { select: { id: true, name: true } } },
    });
    expect(db.schedule.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies search where clause when search option provided", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(1, 5, { search: "daily" }, asDb(db));

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "daily", mode: "insensitive" } },
          { description: { contains: "daily", mode: "insensitive" } },
        ],
      },
      skip: 0,
      take: 5,
      orderBy: { name: "asc" },
      include: { pipeline: { select: { id: true, name: true } } },
    });
    expect(db.schedule.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "daily", mode: "insensitive" } },
          { description: { contains: "daily", mode: "insensitive" } },
        ],
      },
    });
  });

  it("uses sortBy nextRunAt and sortDir desc when specified", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(
      2,
      15,
      { sortBy: "nextRunAt", sortDir: "desc" },
      asDb(db),
    );

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 15,
      take: 15,
      orderBy: { nextRunAt: "desc" },
      include: { pipeline: { select: { id: true, name: true } } },
    });
  });

  it("uses sortBy created and sortBy enabled when specified", async () => {
    const db = createMockDb();
    db.schedule.findMany.mockResolvedValue([]);
    db.schedule.count.mockResolvedValue(0);

    await getSchedulesPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { pipeline: { select: { id: true, name: true } } },
    });

    db.schedule.findMany.mockClear();
    await getSchedulesPage(
      1,
      10,
      { sortBy: "enabled", sortDir: "asc" },
      asDb(db),
    );
    expect(db.schedule.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { enabled: "asc" },
      include: { pipeline: { select: { id: true, name: true } } },
    });
  });

  it("returns schedules, total, page, and pageSize", async () => {
    const db = createMockDb();
    const schedules = [
      {
        id: "s1",
        name: "Daily run",
        description: "Runs daily",
        repeat: "repeating" as const,
        cronExpression: "0 6 * * *",
        interval: null,
        timezone: "UTC",
        startAt: null,
        nextRunAt: new Date(),
        pipelineId: "p1",
        params: {},
        retryConfig: null,
        timeout: null,
        priority: 0,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        pipeline: { id: "p1", name: "Main pipeline" },
      },
    ];
    db.schedule.findMany.mockResolvedValue(schedules);
    db.schedule.count.mockResolvedValue(1);

    const result = await getSchedulesPage(1, 10, undefined, asDb(db));

    expect(result).toEqual({
      schedules,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});

describe("getScheduleById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id and include pipeline", async () => {
    const db = createMockDb();
    db.schedule.findUnique.mockResolvedValue(null);

    await getScheduleById("schedule-uuid-1", asDb(db));

    expect(db.schedule.findUnique).toHaveBeenCalledWith({
      where: { id: "schedule-uuid-1" },
      include: { pipeline: true },
    });
  });

  it("returns the schedule with pipeline when found", async () => {
    const db = createMockDb();
    const schedule = {
      id: "schedule-uuid-1",
      name: "Test",
      description: null,
      repeat: "once" as const,
      cronExpression: null,
      interval: null,
      timezone: "America/New_York",
      startAt: new Date(),
      nextRunAt: new Date(),
      pipelineId: "p1",
      params: {},
      retryConfig: null,
      timeout: null,
      priority: 0,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      pipeline: {
        id: "p1",
        name: "Pipeline",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    db.schedule.findUnique.mockResolvedValue(schedule);

    const result = await getScheduleById("schedule-uuid-1", asDb(db));

    expect(result).toEqual(schedule);
  });

  it("returns null when not found", async () => {
    const db = createMockDb();
    db.schedule.findUnique.mockResolvedValue(null);

    const result = await getScheduleById("missing-id", asDb(db));

    expect(result).toBeNull();
  });
});

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@mediapulse/database/client";

import { getEntityTypeById, getEntityTypesPage } from "./entity-types";

type MockDb = {
  entityType: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  entityType: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getEntityTypesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany with skip, take, default orderBy (name asc) and count", async () => {
    // Setup
    const db = createMockDb();
    db.entityType.findMany.mockResolvedValue([]);
    db.entityType.count.mockResolvedValue(0);

    // Act
    await getEntityTypesPage(2, 10, undefined, asDb(db));

    // Assert
    expect(db.entityType.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 10,
      take: 10,
      orderBy: { name: "asc" },
    });
    expect(db.entityType.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies sortBy created and sortDir desc when provided", async () => {
    // Setup
    const db = createMockDb();
    db.entityType.findMany.mockResolvedValue([]);
    db.entityType.count.mockResolvedValue(0);

    // Act
    await getEntityTypesPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    // Assert
    expect(db.entityType.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
    });
  });

  it("applies search filter on name when search option provided", async () => {
    // Setup
    const db = createMockDb();
    db.entityType.findMany.mockResolvedValue([]);
    db.entityType.count.mockResolvedValue(0);

    // Act
    await getEntityTypesPage(1, 10, { search: "company" }, asDb(db));

    // Assert
    const expectedWhere = {
      name: { contains: "company", mode: "insensitive" as const },
    };
    expect(db.entityType.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      skip: 0,
      take: 10,
      orderBy: { name: "asc" },
    });
    expect(db.entityType.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("returns entity types, total, page, pageSize", async () => {
    // Setup
    const db = createMockDb();
    const entityTypes = [
      {
        id: "et-1",
        name: "COMPANY",
        description: "Organization entity",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.entityType.findMany.mockResolvedValue(entityTypes);
    db.entityType.count.mockResolvedValue(1);

    // Act
    const result = await getEntityTypesPage(1, 10, undefined, asDb(db));

    // Assert
    expect(result).toEqual({
      entityTypes,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});

describe("getEntityTypeById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id", async () => {
    // Setup
    const db = createMockDb();
    db.entityType.findUnique.mockResolvedValue(null);

    // Act
    await getEntityTypeById("et-1", asDb(db));

    // Assert
    expect(db.entityType.findUnique).toHaveBeenCalledWith({
      where: { id: "et-1" },
    });
  });
});

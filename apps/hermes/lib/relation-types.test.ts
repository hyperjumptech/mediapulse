/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@workspace/database/client";

import { getRelationTypeById, getRelationTypesPage } from "./relation-types";

type MockDb = {
  relationType: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  relationType: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getRelationTypesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany with skip, take, default orderBy (name asc) and count", async () => {
    // Setup
    const db = createMockDb();
    db.relationType.findMany.mockResolvedValue([]);
    db.relationType.count.mockResolvedValue(0);

    // Act
    await getRelationTypesPage(2, 10, undefined, asDb(db));

    // Assert
    expect(db.relationType.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 10,
      take: 10,
      orderBy: { name: "asc" },
    });
    expect(db.relationType.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies sortBy created and sortDir desc when provided", async () => {
    // Setup
    const db = createMockDb();
    db.relationType.findMany.mockResolvedValue([]);
    db.relationType.count.mockResolvedValue(0);

    // Act
    await getRelationTypesPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    // Assert
    expect(db.relationType.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
    });
  });

  it("applies search filter on name when search option provided", async () => {
    // Setup
    const db = createMockDb();
    db.relationType.findMany.mockResolvedValue([]);
    db.relationType.count.mockResolvedValue(0);

    // Act
    await getRelationTypesPage(1, 10, { search: "ceo" }, asDb(db));

    // Assert
    const expectedWhere = {
      name: { contains: "ceo", mode: "insensitive" as const },
    };
    expect(db.relationType.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      skip: 0,
      take: 10,
      orderBy: { name: "asc" },
    });
    expect(db.relationType.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });
});

describe("getRelationTypeById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id", async () => {
    // Setup
    const db = createMockDb();
    db.relationType.findUnique.mockResolvedValue(null);

    // Act
    await getRelationTypeById("rt-1", asDb(db));

    // Assert
    expect(db.relationType.findUnique).toHaveBeenCalledWith({
      where: { id: "rt-1" },
    });
  });
});

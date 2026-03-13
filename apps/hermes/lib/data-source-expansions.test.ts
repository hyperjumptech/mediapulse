/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataSourceExpansion,
  deleteDataSourceExpansion,
  getDataSourceExpansionById,
  getDataSourceExpansionsPage,
  updateDataSourceExpansion,
} from "./data-source-expansions";

const createMockDb = (overrides?: {
  findMany?: ReturnType<typeof vi.fn>;
  count?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  deleteMany?: ReturnType<typeof vi.fn>;
}) => {
  return {
    dataSourceExpansion: {
      findMany: overrides?.findMany ?? vi.fn(),
      count: overrides?.count ?? vi.fn(),
      findUnique: overrides?.findUnique ?? vi.fn(),
      create: overrides?.create ?? vi.fn(),
      update: overrides?.update ?? vi.fn(),
      deleteMany: overrides?.deleteMany ?? vi.fn(),
    },
  } as never;
};

describe("getDataSourceExpansionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated expansions with total and page info", async () => {
    // Setup
    const rows = [
      {
        id: "e1",
        name: "Tickers",
        expansionString: "db:ticker:all:id",
        description: "All ticker IDs",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(1);
    const db = createMockDb({ findMany, count });

    // Act
    const result = await getDataSourceExpansionsPage(1, 10, undefined, db);

    // Assert
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0]?.name).toBe("Tickers");
    expect(result.expansions[0]?.expansionString).toBe("db:ticker:all:id");
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("applies search where when search term provided", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = createMockDb({ findMany, count });

    // Act
    await getDataSourceExpansionsPage(1, 10, { search: "ticker" }, db);

    // Assert
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "ticker", mode: "insensitive" } },
            { description: { contains: "ticker", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("applies sort by name asc by default", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = createMockDb({ findMany, count });

    // Act
    await getDataSourceExpansionsPage(1, 10, undefined, db);

    // Assert
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } }),
    );
  });

  it("applies sort by created desc when requested", async () => {
    // Setup
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = createMockDb({ findMany, count });

    // Act
    await getDataSourceExpansionsPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      db,
    );

    // Assert
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("getDataSourceExpansionById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns expansion when found", async () => {
    // Setup
    const row = {
      id: "e1",
      name: "Test",
      expansionString: "db:ticker:all:id",
      description: "Desc",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const findUnique = vi.fn().mockResolvedValue(row);
    const db = createMockDb({ findUnique });

    // Act
    const result = await getDataSourceExpansionById("e1", db);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.id).toBe("e1");
    expect(result?.name).toBe("Test");
  });

  it("returns null when not found", async () => {
    // Setup
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = createMockDb({ findUnique });

    // Act
    const result = await getDataSourceExpansionById("missing", db);

    // Assert
    expect(result).toBeNull();
  });
});

describe("createDataSourceExpansion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates expansion with trimmed name and string, optional description", async () => {
    // Setup
    const created = {
      id: "e1",
      name: "My expansion",
      expansionString: "db:ticker:all:id",
      description: "Notes",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const create = vi.fn().mockResolvedValue(created);
    const db = createMockDb({ create });

    // Act
    const result = await createDataSourceExpansion(
      {
        name: "  My expansion  ",
        expansionString: "  db:ticker:all:id  ",
        description: "Notes",
        createdById: "user-1",
      },
      db,
    );

    // Assert
    expect(create).toHaveBeenCalledWith({
      data: {
        name: "My expansion",
        expansionString: "db:ticker:all:id",
        description: "Notes",
        createdBy: { connect: { id: "user-1" } },
      },
    });
    expect(result.id).toBe("e1");
    expect(result.name).toBe("My expansion");
  });

  it("stores null description when empty or omitted", async () => {
    // Setup
    const created = {
      id: "e1",
      name: "X",
      expansionString: "db:ticker:all:id",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const create = vi.fn().mockResolvedValue(created);
    const db = createMockDb({ create });

    // Act
    await createDataSourceExpansion(
      {
        name: "X",
        expansionString: "db:ticker:all:id",
        description: "   ",
        createdById: "user-1",
      },
      db,
    );

    // Assert
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: null }),
    });
  });
});

describe("updateDataSourceExpansion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates expansion and returns row", async () => {
    // Setup
    const updated = {
      id: "e1",
      name: "New name",
      expansionString: "db:userTicker:all:tickerId",
      description: "New desc",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const update = vi.fn().mockResolvedValue(updated);
    const db = createMockDb({ update });

    // Act
    const result = await updateDataSourceExpansion(
      "e1",
      {
        name: "New name",
        expansionString: "db:userTicker:all:tickerId",
        description: "New desc",
      },
      db,
    );

    // Assert
    expect(result).not.toBeNull();
    expect(result?.name).toBe("New name");
    expect(update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        name: "New name",
        expansionString: "db:userTicker:all:tickerId",
        description: "New desc",
      },
    });
  });

  it("returns null when record not found", async () => {
    // Setup
    const update = vi
      .fn()
      .mockRejectedValue(new Error("Record to update not found"));
    const db = createMockDb({ update });

    // Act
    const result = await updateDataSourceExpansion(
      "missing",
      { name: "X", expansionString: "db:ticker:all:id" },
      db,
    );

    // Assert
    expect(result).toBeNull();
  });
});

describe("deleteDataSourceExpansion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when record deleted", async () => {
    // Setup
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = createMockDb({ deleteMany });

    // Act
    const result = await deleteDataSourceExpansion("e1", db);

    // Assert
    expect(result).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "e1" } });
  });

  it("returns false when no record matched", async () => {
    // Setup
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const db = createMockDb({ deleteMany });

    // Act
    const result = await deleteDataSourceExpansion("missing", db);

    // Assert
    expect(result).toBe(false);
  });
});

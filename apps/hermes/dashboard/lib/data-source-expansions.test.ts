/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataSourceExpansion,
  deleteDataSourceExpansion,
  getDataSourceExpansionById,
  getDataSourceExpansionsPage,
  updateDataSourceExpansion,
} from "./data-source-expansions";

const IK = "mediapulse";

const buildListResponse = (items: Array<Record<string, unknown>>) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 100,
});

describe("getDataSourceExpansionsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated expansions with total and page info", async () => {
    // Setup
    const rows: Array<Record<string, unknown>> = [
      {
        id: "e1",
        name: "Tickers",
        expansionString: "db:ticker:id",
        description: "All ticker IDs",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
      },
    ];
    const getList = vi.fn().mockResolvedValue({
      items: rows,
      total: 1,
      page: 1,
      pageSize: 10,
    });

    // Act
    const result = await getDataSourceExpansionsPage(IK, 1, 10, undefined, {
      getList,
    });

    // Assert
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0]?.name).toBe("Tickers");
    expect(result.expansions[0]?.expansionString).toBe("db:ticker:id");
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it("applies search where when search term provided", async () => {
    // Setup
    const getList = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    // Act
    await getDataSourceExpansionsPage(
      IK,
      1,
      10,
      { search: "ticker" },
      {
        getList,
      },
    );

    // Assert
    expect(getList).toHaveBeenCalledWith(
      IK,
      "data-source-expansions",
      expect.objectContaining({
        query: "ticker",
      }),
    );
  });

  it("applies sort by name asc by default", async () => {
    // Setup
    const getList = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    // Act
    await getDataSourceExpansionsPage(IK, 1, 10, undefined, { getList });

    // Assert
    expect(getList).toHaveBeenCalledWith(
      IK,
      "data-source-expansions",
      expect.objectContaining({ sortBy: "name", sortDir: "asc" }),
    );
  });

  it("applies sort by created desc when requested", async () => {
    // Setup
    const getList = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    // Act
    await getDataSourceExpansionsPage(
      IK,
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      { getList },
    );

    // Assert
    expect(getList).toHaveBeenCalledWith(
      IK,
      "data-source-expansions",
      expect.objectContaining({ sortBy: "createdAt", sortDir: "desc" }),
    );
  });
});

describe("getDataSourceExpansionById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns expansion when found", async () => {
    // Setup
    const row: Record<string, unknown> = {
      id: "e1",
      name: "Test",
      expansionString: "db:ticker:id",
      description: "Desc",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    const getList = vi.fn().mockResolvedValue(buildListResponse([row]));

    // Act
    const result = await getDataSourceExpansionById(IK, "e1", { getList });

    // Assert
    expect(result).not.toBeNull();
    expect(result?.id).toBe("e1");
    expect(result?.name).toBe("Test");
  });

  it("returns null when not found", async () => {
    // Setup
    const getList = vi.fn().mockResolvedValue(buildListResponse([]));

    // Act
    const result = await getDataSourceExpansionById(IK, "missing", {
      getList,
    });

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
    const created: Record<string, unknown> = {
      id: "e1",
      name: "My expansion",
      expansionString: "db:ticker:id",
      description: "Notes",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    const createItem = vi.fn().mockResolvedValue({ id: "e1" });
    const getList = vi.fn().mockResolvedValue(buildListResponse([created]));

    // Act
    const result = await createDataSourceExpansion(
      IK,
      {
        name: "  My expansion  ",
        expansionString: "  db:ticker:id  ",
        description: "Notes",
        createdById: "user-1",
      },
      { createItem, getList },
    );

    // Assert
    expect(createItem).toHaveBeenCalledWith(IK, "data-source-expansions", {
      name: "My expansion",
      expansionString: "db:ticker:id",
      description: "Notes",
    });
    expect(result.id).toBe("e1");
    expect(result.name).toBe("My expansion");
  });

  it("stores null description when empty or omitted", async () => {
    // Setup
    const created: Record<string, unknown> = {
      id: "e1",
      name: "X",
      expansionString: "db:ticker:id",
      description: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
    };
    const createItem = vi.fn().mockResolvedValue({ id: "e1" });
    const getList = vi.fn().mockResolvedValue(buildListResponse([created]));

    // Act
    await createDataSourceExpansion(
      IK,
      {
        name: "X",
        expansionString: "db:ticker:id",
        description: "   ",
        createdById: "user-1",
      },
      { createItem, getList },
    );

    // Assert
    expect(createItem).toHaveBeenCalledWith(
      IK,
      "data-source-expansions",
      expect.objectContaining({ description: null }),
    );
  });

  it("throws when created item cannot be loaded", async () => {
    // Setup
    const createItem = vi.fn().mockResolvedValue({ id: "e1" });
    const getList = vi.fn().mockResolvedValue(buildListResponse([]));

    // Act & Assert
    await expect(
      createDataSourceExpansion(
        IK,
        {
          name: "X",
          expansionString: "db:ticker:id",
          createdById: "user-1",
        },
        { createItem, getList },
      ),
    ).rejects.toThrow("Created data source expansion could not be loaded");
  });
});

describe("updateDataSourceExpansion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates expansion and returns row", async () => {
    // Setup
    const updateItem = vi.fn().mockResolvedValue({ id: "e1" });
    const getList = vi.fn().mockResolvedValue(
      buildListResponse([
        {
          id: "e1",
          name: "New name",
          expansionString: "db:userTicker:tickerId",
          description: "New desc",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
      ]),
    );

    // Act
    const result = await updateDataSourceExpansion(
      IK,
      "e1",
      {
        name: "New name",
        expansionString: "db:userTicker:tickerId",
        description: "New desc",
      },
      { updateItem, getList },
    );

    // Assert
    expect(result).not.toBeNull();
    expect(result?.name).toBe("New name");
    expect(updateItem).toHaveBeenCalledWith(
      IK,
      "data-source-expansions",
      "e1",
      {
        name: "New name",
        expansionString: "db:userTicker:tickerId",
        description: "New desc",
      },
    );
  });

  it("returns null when record not found", async () => {
    // Setup
    const updateItem = vi
      .fn()
      .mockRejectedValue(new Error("Record to update not found"));
    const getList = vi.fn().mockResolvedValue(buildListResponse([]));

    // Act
    const result = await updateDataSourceExpansion(
      IK,
      "missing",
      { name: "X", expansionString: "db:ticker:id" },
      { updateItem, getList },
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
    const deleteItem = vi.fn().mockResolvedValue({ ok: true });

    // Act
    const result = await deleteDataSourceExpansion(IK, "e1", { deleteItem });

    // Assert
    expect(result).toBe(true);
    expect(deleteItem).toHaveBeenCalledWith(IK, "data-source-expansions", "e1");
  });

  it("returns false when no record matched", async () => {
    // Setup
    const deleteItem = vi.fn().mockRejectedValue(new Error("Not found"));

    // Act
    const result = await deleteDataSourceExpansion(IK, "missing", {
      deleteItem,
    });

    // Assert
    expect(result).toBe(false);
  });
});

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiKeysPage } from "./api-keys";
import type { PrismaClientWithSchema } from "@workspace/database/client";

type MockDb = {
  aPIKey: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  aPIKey: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
});

/** Cast minimal mock to PrismaClientWithSchema for tests. */
const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getApiKeysPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany and count with default sort and no search when options omitted", async () => {
    const db = createMockDb();
    db.aPIKey.findMany.mockResolvedValue([]);
    db.aPIKey.count.mockResolvedValue(0);

    await getApiKeysPage(1, 10, undefined, asDb(db));

    expect(db.aPIKey.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { name: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    expect(db.aPIKey.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("applies search where clause when search option provided", async () => {
    const db = createMockDb();
    db.aPIKey.findMany.mockResolvedValue([]);
    db.aPIKey.count.mockResolvedValue(0);

    await getApiKeysPage(1, 5, { search: "my-key" }, asDb(db));

    expect(db.aPIKey.findMany).toHaveBeenCalledWith({
      where: { name: { contains: "my-key", mode: "insensitive" } },
      skip: 0,
      take: 5,
      orderBy: { name: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    expect(db.aPIKey.count).toHaveBeenCalledWith({
      where: { name: { contains: "my-key", mode: "insensitive" } },
    });
  });

  it("uses sortBy created and sortDir desc when specified", async () => {
    const db = createMockDb();
    db.aPIKey.findMany.mockResolvedValue([]);
    db.aPIKey.count.mockResolvedValue(0);

    await getApiKeysPage(
      1,
      10,
      { sortBy: "created", sortDir: "desc" },
      asDb(db),
    );

    expect(db.aPIKey.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("uses sortBy name and sortDir asc when specified", async () => {
    const db = createMockDb();
    db.aPIKey.findMany.mockResolvedValue([]);
    db.aPIKey.count.mockResolvedValue(0);

    await getApiKeysPage(2, 15, { sortBy: "name", sortDir: "asc" }, asDb(db));

    expect(db.aPIKey.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 15,
      take: 15,
      orderBy: { name: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  });

  it("returns apiKeys, total, page, and pageSize", async () => {
    const db = createMockDb();
    const apiKeys = [
      {
        id: "key-1",
        name: "Test key",
        key: "hashed",
        isActive: true,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: "user-1", name: "Admin", email: "admin@example.com" },
      },
    ];
    db.aPIKey.findMany.mockResolvedValue(apiKeys);
    db.aPIKey.count.mockResolvedValue(1);

    const result = await getApiKeysPage(1, 10, undefined, asDb(db));

    expect(result).toEqual({
      apiKeys,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it("ignores empty or whitespace-only search", async () => {
    const db = createMockDb();
    db.aPIKey.findMany.mockResolvedValue([]);
    db.aPIKey.count.mockResolvedValue(0);

    await getApiKeysPage(1, 10, { search: "   " }, asDb(db));

    expect(db.aPIKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });
});

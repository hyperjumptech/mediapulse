/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  createSearchQuerySet,
  deactivateActiveSetsForTicker,
  deleteSearchQuerySet,
  findDuplicateQueryTexts,
  replaceSearchQueriesForSet,
  SearchQuerySetPersistError,
  updateSearchQuerySet,
} from "./search-query-set-persist";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const SET_ID = "22222222-2222-4222-a222-222222222222";

describe("findDuplicateQueryTexts", () => {
  it("returns null when texts are unique", () => {
    // Act
    const result = findDuplicateQueryTexts([
      { text: "a", intent: "industryPulse", rank: 1 },
      { text: "b", intent: "industryPulse", rank: 2 },
    ]);

    // Assert
    expect(result).toBeNull();
  });

  it("returns a message when duplicate texts exist", () => {
    // Act
    const result = findDuplicateQueryTexts([
      { text: "dup", intent: "industryPulse", rank: 1 },
      { text: "dup", intent: "dealsAndMovements", rank: 2 },
    ]);

    // Assert
    expect(result).toContain("dup");
  });
});

describe("deactivateActiveSetsForTicker", () => {
  it("calls updateMany for active sets on the ticker", async () => {
    // Setup
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      searchQuerySet: {
        updateMany,
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    // Act
    await deactivateActiveSetsForTicker(TICKER_ID, db);

    // Assert
    expect(updateMany).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, isActive: true },
      data: { isActive: false },
    });
  });
});

describe("createSearchQuerySet", () => {
  it("deactivates other sets and creates nested queries when active", async () => {
    // Setup
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: SET_ID });
    const db = {
      searchQuerySet: {
        updateMany,
        create,
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    // Act
    const result = await createSearchQuerySet(
      {
        tickerId: TICKER_ID,
        isActive: true,
        generationSource: "manual",
        strategySnapshot: { queryCount: 2 },
        queries: [{ text: "q1", intent: "industryPulse", rank: 1 }],
      },
      db,
    );

    // Assert
    expect(updateMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: SET_ID, queryCount: 1 });
  });

  it("throws when duplicate query texts are submitted", async () => {
    // Setup
    const db = {
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    // Act & Assert
    await expect(
      createSearchQuerySet(
        {
          tickerId: TICKER_ID,
          isActive: false,
          generationSource: "manual",
          strategySnapshot: {},
          queries: [
            { text: "same", intent: "industryPulse", rank: 1 },
            { text: "same", intent: "industryPulse", rank: 2 },
          ],
        },
        db,
      ),
    ).rejects.toBeInstanceOf(SearchQuerySetPersistError);
  });
});

describe("replaceSearchQueriesForSet", () => {
  it("deletes existing queries then createMany", async () => {
    // Setup
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany, createMany },
    };

    // Act
    await replaceSearchQueriesForSet(
      SET_ID,
      TICKER_ID,
      [{ text: "new", intent: "disruptorsOrTech", rank: 1 }],
      db,
    );

    // Assert
    expect(deleteMany).toHaveBeenCalledWith({ where: { setId: SET_ID } });
    expect(createMany).toHaveBeenCalledOnce();
  });
});

describe("updateSearchQuerySet", () => {
  it("deactivates siblings when turning isActive on", async () => {
    // Setup
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: SET_ID, tickerId: TICKER_ID, isActive: false });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ id: SET_ID });
    const db = {
      searchQuerySet: {
        findUnique,
        updateMany,
        update,
        create: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    // Act
    const result = await updateSearchQuerySet(SET_ID, { isActive: true }, db);

    // Assert
    expect(updateMany).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(result.id).toBe(SET_ID);
  });

  it("throws 404 when set is missing", async () => {
    // Setup
    const db = {
      searchQuerySet: {
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    // Act & Assert
    await expect(
      updateSearchQuerySet(SET_ID, { generationSource: "x" }, db),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("deleteSearchQuerySet", () => {
  it("deletes queries then the set", async () => {
    // Setup
    const findUnique = vi.fn().mockResolvedValue({ id: SET_ID });
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const del = vi.fn().mockResolvedValue({ id: SET_ID });
    const db = {
      searchQuerySet: {
        findUnique,
        delete: del,
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      searchQuery: { deleteMany, createMany: vi.fn() },
    };

    // Act
    await deleteSearchQuerySet(SET_ID, db);

    // Assert
    expect(deleteMany).toHaveBeenCalledWith({ where: { setId: SET_ID } });
    expect(del).toHaveBeenCalledWith({ where: { id: SET_ID } });
  });
});

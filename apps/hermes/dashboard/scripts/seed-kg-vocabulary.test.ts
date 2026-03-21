/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@workspace/mediapulse-database/client";
import { seedKgVocabulary } from "./seed-kg-vocabulary";

type MockDb = {
  entityType: {
    upsert: ReturnType<typeof vi.fn>;
  };
  relationType: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  entityType: {
    upsert: vi.fn().mockResolvedValue(undefined),
  },
  relationType: {
    upsert: vi.fn().mockResolvedValue(undefined),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("seedKgVocabulary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts all default entity types and relation types", async () => {
    const db = createMockDb();

    const result = await seedKgVocabulary(asDb(db));

    expect(result).toEqual({
      entityTypesSeeded: 6,
      relationTypesSeeded: 7,
    });
    expect(db.entityType.upsert).toHaveBeenCalledTimes(6);
    expect(db.relationType.upsert).toHaveBeenCalledTimes(7);
  });

  it("upserts by unique name with description updates", async () => {
    const db = createMockDb();

    await seedKgVocabulary(asDb(db));

    expect(db.entityType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: "COMPANY" },
        create: expect.objectContaining({ name: "COMPANY" }),
        update: expect.objectContaining({
          description: "A registered business, corporation, or organization",
        }),
      }),
    );

    expect(db.relationType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: "CEO_OF" },
        create: expect.objectContaining({ name: "CEO_OF" }),
        update: expect.objectContaining({
          description: "Person is the CEO or top executive of a company",
        }),
      }),
    );
  });
});

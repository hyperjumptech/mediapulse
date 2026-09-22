/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  applyExtraction,
  listExtractionCandidates,
  resolveRelationKind,
  seedRelationKinds,
  spanIsInArticle,
  upsertEntity,
  type KnowledgeExtractionDb,
} from "./knowledge-extraction";

const article = {
  id: "11111111-1111-4111-a111-111111111111",
  title: "Fore Coffee dan Kopi Kenangan bersaing",
  description: "BPOM menerbitkan aturan baru untuk minuman kemasan.",
  content: null,
};

const ticker = {
  id: "22222222-2222-4222-a222-222222222222",
  symbol: "FORE",
  name: "Fore Kopi Indonesia",
  aliases: ["Fore Coffee"],
};

type Delegates = {
  entityByName?: Record<string, { id: string }>;
  aliasHit?: { entityId: string } | null;
  kindAlias?: { kindSlug: string; inverted: boolean } | null;
  issuerEntityId?: string | null;
  existingRelation?: { id: string; evidenceSpan: string | null } | null;
};

const buildDb = (overrides: Delegates = {}) => {
  const created: Record<string, unknown>[] = [];
  const relationsCreated: Record<string, unknown>[] = [];
  const mentionsCreated: Record<string, unknown>[] = [];
  let entitySequence = 0;

  const db = {
    ticker: { findUnique: vi.fn().mockResolvedValue(ticker) },
    dataSource: {
      findUnique: vi.fn().mockResolvedValue(article),
      findMany: vi.fn().mockResolvedValue([]),
    },
    knowledgeEntity: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            overrides.entityByName?.[where.normalizedName] ?? null,
          ),
        ),
      create: vi.fn().mockImplementation(({ data }) => {
        entitySequence += 1;
        created.push(data);

        return Promise.resolve({ id: `entity-${String(entitySequence)}` });
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    knowledgeEntityAlias: {
      findFirst: vi.fn().mockResolvedValue(overrides.aliasHit ?? null),
      upsert: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    knowledgeTickerEntity: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides.issuerEntityId === undefined
            ? { entityId: "issuer-entity" }
            : overrides.issuerEntityId === null
              ? null
              : { entityId: overrides.issuerEntityId },
        ),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    knowledgeRelation: {
      findUnique: vi.fn().mockResolvedValue(overrides.existingRelation ?? null),
      create: vi.fn().mockImplementation(({ data }) => {
        relationsCreated.push(data);

        return Promise.resolve({ id: "relation-1" });
      }),
      update: vi.fn().mockResolvedValue({ id: "relation-1" }),
    },
    knowledgeRelationKind: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    knowledgeRelationKindAlias: {
      findFirst: vi.fn().mockResolvedValue(overrides.kindAlias ?? null),
      upsert: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    knowledgeTickerRelation: { upsert: vi.fn().mockResolvedValue({}) },
    knowledgeEntityMention: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => {
        mentionsCreated.push(data);

        return Promise.resolve({});
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    knowledgeExtractionRun: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "run-1" }),
      update: vi.fn().mockResolvedValue({ tickerId: null }),
    },
  } as unknown as KnowledgeExtractionDb;

  return { db, created, relationsCreated, mentionsCreated };
};

const extraction = (
  overrides: Partial<Parameters<typeof applyExtraction>[1]> = {},
): Parameters<typeof applyExtraction>[1] => ({
  tickerId: ticker.id,
  dataSourceId: article.id,
  extractionRunId: null,
  entities: [],
  relations: [],
  ...overrides,
});

describe("listExtractionCandidates", () => {
  it("offers only curated relation kinds, so invented ones do not feed themselves back", async () => {
    const { db } = buildDb();

    await listExtractionCandidates(db, {
      tickerId: ticker.id,
      fromStart: true,
    });

    const call = vi.mocked(db.knowledgeRelationKind.findMany).mock
      .calls[0]?.[0];

    expect(call?.where).toStrictEqual({ curated: true });
  });
});

describe("spanIsInArticle", () => {
  it("accepts a verbatim span and rejects a paraphrase", () => {
    expect(spanIsInArticle(article.title, "Kopi Kenangan bersaing")).toBe(true);
    expect(spanIsInArticle(article.title, "they are rivals")).toBe(false);
  });
});

describe("applyExtraction", () => {
  it("refuses a person whatever the agent claims, and never writes a mention", async () => {
    const { db, mentionsCreated } = buildDb();

    const result = await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Sheila Dara",
            kind: "person",
            surfaceForm: "Sheila Dara",
            evidenceSpan: article.title,
          },
        ],
      }),
    );

    expect(result.rejected).toEqual([
      { reason: "person", detail: "Sheila Dara" },
    ]);
    expect(mentionsCreated).toHaveLength(0);
  });

  it("refuses an entity whose span is not in the stored article, whoever sent it", async () => {
    const { db, mentionsCreated } = buildDb();

    const result = await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "a sentence the article never carried",
          },
        ],
      }),
    );

    expect(result.rejected).toStrictEqual([
      { reason: "span-not-in-text", detail: "Kopi Kenangan" },
    ]);
    expect(mentionsCreated).toHaveLength(0);
  });

  it("refuses an entity the stored article never names", async () => {
    const { db } = buildDb();

    const result = await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Starbucks",
            kind: "brand",
            surfaceForm: "Starbucks",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
    );

    expect(result.rejected[0]?.reason).toBe("name-not-in-text");
  });

  it("writes a mention for an entity the article does name", async () => {
    const { db, mentionsCreated } = buildDb();

    const result = await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
    );

    expect(result.entitiesCreated).toBe(1);
    expect(result.mentionsWritten).toBe(1);
    expect(mentionsCreated[0]).toMatchObject({
      dataSourceId: article.id,
      surfaceForm: "Kopi Kenangan",
    });
  });

  it("stores an article's issuer claim as a company, never as a second issuer", async () => {
    const { db, created } = buildDb();

    await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "issuer",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
    );

    expect(created[0]).toMatchObject({ kind: "company" });
  });

  it("puts the regulator on the subject side of `regulates`, whichever way it arrived", async () => {
    const { db, relationsCreated } = buildDb({
      kindAlias: { kindSlug: "regulates", inverted: false },
    });

    await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "BPOM",
            kind: "regulator",
            surfaceForm: "BPOM",
            evidenceSpan: "BPOM menerbitkan aturan baru",
          },
        ],
        relations: [
          {
            subject: "Fore Coffee",
            kind: "regulates",
            object: "BPOM",
            evidenceSpan: "BPOM menerbitkan aturan baru",
          },
        ],
      }),
    );

    expect(relationsCreated[0]).toMatchObject({
      subjectEntityId: "entity-1",
      objectEntityId: "issuer-entity",
      kindSlug: "regulates",
    });
  });

  it("swaps the endpoints when the phrase reads the relation backwards", async () => {
    const { db, relationsCreated } = buildDb({
      kindAlias: { kindSlug: "supplies", inverted: true },
    });

    await applyExtraction(
      db,
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
        relations: [
          {
            subject: "Fore Coffee",
            kind: "supplied by",
            object: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
    );

    expect(relationsCreated[0]).toMatchObject({
      subjectEntityId: "entity-1",
      objectEntityId: "issuer-entity",
    });
  });

  it("throws when the article does not exist, rather than writing a groundless claim", async () => {
    const { db } = buildDb();
    (db.dataSource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    await expect(applyExtraction(db, extraction())).rejects.toThrow(
      /does not exist/u,
    );
  });
});

describe("resolveRelationKind", () => {
  it("resolves a known phrasing through its alias", async () => {
    const { db } = buildDb({
      kindAlias: { kindSlug: "competes_with", inverted: false },
    });

    const resolved = await resolveRelationKind(db, "rival of", null);

    expect(resolved).toStrictEqual({
      slug: "competes_with",
      inverted: false,
      created: false,
    });
  });

  it("creates an uncurated kind for a phrase the registry has never seen", async () => {
    const { db } = buildDb();

    const resolved = await resolveRelationKind(db, "sponsors", "run-1");

    expect(resolved).toMatchObject({ slug: "sponsors", created: true });
    expect(db.knowledgeRelationKind.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ curated: false, slug: "sponsors" }),
      }),
    );
  });

  it("returns nothing for a phrase that normalises away", async () => {
    const { db } = buildDb();

    expect(await resolveRelationKind(db, "  ", null)).toBeNull();
  });
});

describe("upsertEntity", () => {
  it("reuses an entity found by one of its aliases", async () => {
    const { db } = buildDb({ aliasHit: { entityId: "existing" } });

    const result = await upsertEntity(db, {
      kind: "company",
      canonicalName: "PT Mitra Adiperkasa Tbk",
      source: "profile",
    });

    expect(result).toStrictEqual({ id: "existing", created: false });
    expect(db.knowledgeEntity.create).not.toHaveBeenCalled();
  });

  it("refuses a name that normalises to nothing", async () => {
    const { db } = buildDb();

    await expect(
      upsertEntity(db, {
        kind: "company",
        canonicalName: "PT Tbk",
        source: "profile",
      }),
    ).rejects.toThrow(/normalises to nothing/u);
  });
});

describe("seedRelationKinds", () => {
  it("marks every seeded kind curated and records its phrasings", async () => {
    const { db } = buildDb();

    await seedRelationKinds(db, [
      {
        slug: "competes_with",
        label: "competes with",
        inverseLabel: null,
        symmetric: true,
        aliases: ["rival of"],
        invertedAliases: [],
      },
    ]);

    expect(db.knowledgeRelationKind.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ curated: true }),
      }),
    );
    expect(db.knowledgeRelationKindAlias.upsert).toHaveBeenCalled();
  });
});

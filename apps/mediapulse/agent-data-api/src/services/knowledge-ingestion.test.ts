import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  citeKnowledgeDevelopment,
  latestKnowledgeWatermark,
  findKnowledgeStorylineCandidates,
  listKnowledgeCandidateSources,
  openKnowledgeDevelopment,
  openKnowledgeStoryline,
  type KnowledgeDb,
} from "./knowledge-ingestion.js";

const createDb = (overrides: Record<string, unknown> = {}) => {
  const db = {
    dataSource: { findMany: vi.fn() },
    storyline: {
      create: vi.fn().mockResolvedValue({ id: "story-1" }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    storylineAnchor: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    storylineTicker: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
    },
    development: {
      create: vi.fn().mockResolvedValue({ id: "dev-1" }),
      count: vi.fn().mockResolvedValue(1),
    },
    developmentAnchor: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    developmentCitation: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    knowledgeIngestionRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };

  return db as unknown as KnowledgeDb & typeof db;
};

const storylineBody = {
  name: "Telkom Pangkas Anak Usaha",
  title: "Telkom Pangkas Anak Usaha",
  observedAt: "2026-06-29T00:00:00.000Z",
  anchors: ["telkom", "anak", "usaha"],
  titleAnchors: ["telkom", "usaha"],
  figures: [],
  dataSourceId: "ds-1",
  tickerIds: ["ticker-tlkm"],
  ingestionRunId: "run-1",
};

describe("listKnowledgeCandidateSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers fetched content and falls back to the collection description", async () => {
    const db = createDb();
    db.dataSource.findMany.mockResolvedValue([
      {
        id: "ds-1",
        title: "A",
        description: "short",
        content: "full body",
        createdAt: new Date("2026-06-29T01:00:00.000Z"),
        publishedAt: null,
        tickerSections: [{ tickerId: "t1" }],
      },
      {
        id: "ds-2",
        title: "B",
        description: "only description",
        content: null,
        createdAt: new Date("2026-06-29T02:00:00.000Z"),
        publishedAt: new Date("2026-06-28T00:00:00.000Z"),
        tickerSections: [],
      },
    ]);

    const result = await listKnowledgeCandidateSources(undefined, 100, db);

    expect(result.sources[0]?.text).toBe("full body");
    expect(result.sources[1]?.text).toBe("only description");
    expect(result.sources[1]?.publishedDay).toBe("2026-06-28");
    expect(result.watermark).toBe("2026-06-29T02:00:00.000Z");
  });

  it("reads the whole corpus rather than only admitted articles", async () => {
    const db = createDb();
    db.dataSource.findMany.mockResolvedValue([]);

    await listKnowledgeCandidateSources("2026-06-01T00:00:00.000Z", 50, db);

    const args = db.dataSource.findMany.mock.calls[0]?.[0];

    expect(args.where).toEqual({
      developmentCitations: { none: {} },
      createdAt: { gt: new Date("2026-06-01T00:00:00.000Z") },
    });
    expect(args.take).toBe(50);
  });

  it("returns a null watermark when nothing is pending", async () => {
    const db = createDb();
    db.dataSource.findMany.mockResolvedValue([]);

    const result = await listKnowledgeCandidateSources(undefined, 10, db);

    expect(result).toEqual({
      sources: [],
      watermark: null,
      resumedFrom: null,
    });
  });
});

describe("findKnowledgeStorylineCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nothing when the candidate carries no anchors", async () => {
    const db = createDb();

    const result = await findKnowledgeStorylineCandidates([], db);

    expect(result.storylines).toEqual([]);
    expect(db.storylineAnchor.findMany).not.toHaveBeenCalled();
  });

  it("splits development anchors into body and title sets", async () => {
    const db = createDb();
    db.storylineAnchor.findMany.mockResolvedValue([{ storylineId: "story-1" }]);
    db.storyline.findMany.mockResolvedValue([
      {
        id: "story-1",
        locked: false,
        anchors: [{ anchor: "telkom" }, { anchor: "usaha" }],
        _count: { tickers: 2 },
        developments: [
          {
            id: "dev-1",
            observedAt: new Date("2026-06-29T00:00:00.000Z"),
            anchors: [
              { anchor: "telkom", fromTitle: true },
              { anchor: "entitas", fromTitle: false },
            ],
          },
        ],
      },
    ]);

    const result = await findKnowledgeStorylineCandidates(["telkom"], db);

    expect(result.storylines[0]?.tickerCount).toBe(2);
    expect(result.storylines[0]?.developments[0]?.anchors).toEqual(["entitas"]);
    expect(result.storylines[0]?.developments[0]?.titleAnchors).toEqual([
      "telkom",
    ]);
    expect(result.storylines[0]?.developments[0]?.day).toBe("2026-06-29");
  });

  it("excludes storylines flagged as a recurring format", async () => {
    const db = createDb();
    db.storylineAnchor.findMany.mockResolvedValue([{ storylineId: "story-1" }]);
    db.storyline.findMany.mockResolvedValue([]);

    await findKnowledgeStorylineCandidates(["harga"], db);

    const args = db.storyline.findMany.mock.calls[0]?.[0];

    expect(args.where.kind).toBe("story");
  });
});

describe("knowledge writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a storyline with its first development and citation", async () => {
    const db = createDb();

    const result = await openKnowledgeStoryline(storylineBody, db);

    expect(result).toEqual({
      storylineId: "story-1",
      developmentId: "dev-1",
      locked: false,
      lockedReason: null,
    });
    expect(db.developmentCitation.create).toHaveBeenCalledWith({
      data: { developmentId: "dev-1", dataSourceId: "ds-1" },
    });
  });

  it("marks title anchors so the headline path can use them later", async () => {
    const db = createDb();

    await openKnowledgeStoryline(storylineBody, db);

    const rows = db.developmentAnchor.createMany.mock.calls[0]?.[0].data;

    expect(rows).toContainEqual({
      developmentId: "dev-1",
      anchor: "telkom",
      fromTitle: true,
    });
    expect(rows).toContainEqual({
      developmentId: "dev-1",
      anchor: "anak",
      fromTitle: false,
    });
  });

  it("locks a storyline that spreads past the ticker ceiling", async () => {
    const db = createDb();
    db.storylineTicker.count.mockResolvedValue(6);

    const result = await openKnowledgeStoryline(storylineBody, db);

    expect(result.locked).toBe(true);
    expect(result.lockedReason).toContain("6 tickers");
    expect(db.storyline.update).toHaveBeenCalled();
  });

  it("locks a storyline that grows past the development ceiling", async () => {
    const db = createDb();
    db.development.count.mockResolvedValue(41);

    const result = await openKnowledgeDevelopment(
      {
        ...storylineBody,
        storylineId: "story-1",
        evidence: {
          sharedAnchors: 5,
          containment: 0.5,
          storylineContainment: 0.6,
          path: "body" as const,
        },
      },
      db,
    );

    expect(result.locked).toBe(true);
    expect(result.lockedReason).toContain("41 developments");
  });

  it("records the attach evidence on a new development", async () => {
    const db = createDb();
    const evidence = {
      sharedAnchors: 5,
      containment: 0.55,
      storylineContainment: 0.62,
      path: "body" as const,
    };

    await openKnowledgeDevelopment(
      { ...storylineBody, storylineId: "story-1", evidence },
      db,
    );

    expect(db.development.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attachEvidence: evidence }),
      }),
    );
  });

  it("adds a citation without creating a second development", async () => {
    const db = createDb();

    const result = await citeKnowledgeDevelopment(
      {
        storylineId: "story-1",
        developmentId: "dev-1",
        dataSourceId: "ds-2",
        tickerIds: ["ticker-tlkm"],
        observedAt: "2026-07-06T00:00:00.000Z",
        anchors: ["telkom", "entitas"],
      },
      db,
    );

    expect(db.development.create).not.toHaveBeenCalled();
    expect(db.developmentCitation.create).toHaveBeenCalledWith({
      data: { developmentId: "dev-1", dataSourceId: "ds-2" },
    });
    expect(result.developmentId).toBe("dev-1");
  });
});

describe("watermark resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resumes from the newest successful run when no since is given", async () => {
    const db = createDb();
    db.knowledgeIngestionRun.findFirst.mockResolvedValue({
      watermarkAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    db.dataSource.findMany.mockResolvedValue([]);

    const result = await listKnowledgeCandidateSources(undefined, 100, db);
    const args = db.dataSource.findMany.mock.calls[0]?.[0];

    expect(args.where).toEqual({
      developmentCitations: { none: {} },
      createdAt: { gt: new Date("2026-07-01T00:00:00.000Z") },
    });
    expect(result.resumedFrom).toBe("2026-07-01T00:00:00.000Z");
  });

  it("ignores failed runs so their unread articles are not skipped", async () => {
    const db = createDb();
    db.dataSource.findMany.mockResolvedValue([]);

    await listKnowledgeCandidateSources(undefined, 100, db);
    const args = db.knowledgeIngestionRun.findFirst.mock.calls[0]?.[0];

    expect(args.where.status).toBe("success");
    expect(args.orderBy).toEqual({ watermarkAt: "desc" });
  });

  it("lets an explicit since override the stored watermark", async () => {
    const db = createDb();
    db.knowledgeIngestionRun.findFirst.mockResolvedValue({
      watermarkAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    db.dataSource.findMany.mockResolvedValue([]);

    const result = await listKnowledgeCandidateSources(
      "2026-06-01T00:00:00.000Z",
      100,
      db,
    );

    expect(result.resumedFrom).toBe("2026-06-01T00:00:00.000Z");
    expect(db.knowledgeIngestionRun.findFirst).not.toHaveBeenCalled();
  });

  it("rebuilds from the beginning when fromStart is set", async () => {
    const db = createDb();
    db.knowledgeIngestionRun.findFirst.mockResolvedValue({
      watermarkAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    db.dataSource.findMany.mockResolvedValue([]);

    const result = await listKnowledgeCandidateSources(
      undefined,
      100,
      db,
      true,
    );
    const args = db.dataSource.findMany.mock.calls[0]?.[0];

    expect(args.where).toEqual({ developmentCitations: { none: {} } });
    expect(result.resumedFrom).toBeNull();
  });

  it("returns no watermark when the knowledge base is empty", async () => {
    const db = createDb();

    await expect(latestKnowledgeWatermark(db)).resolves.toBeUndefined();
  });
});

describe("idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const alreadyIngested = {
    developmentId: "dev-existing",
    development: {
      storylineId: "story-existing",
      storyline: { locked: false, lockedReason: null },
    },
  };

  it("does not open a second storyline for an article already ingested", async () => {
    const db = createDb();
    db.developmentCitation.findUnique.mockResolvedValue(alreadyIngested);

    const result = await openKnowledgeStoryline(storylineBody, db);

    expect(db.storyline.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      storylineId: "story-existing",
      developmentId: "dev-existing",
      locked: false,
      lockedReason: null,
    });
  });

  it("does not open a second development for an article already ingested", async () => {
    const db = createDb();
    db.developmentCitation.findUnique.mockResolvedValue(alreadyIngested);

    await openKnowledgeDevelopment(
      {
        ...storylineBody,
        storylineId: "story-1",
        evidence: {
          sharedAnchors: 5,
          containment: 0.5,
          storylineContainment: 0.6,
          path: "body" as const,
        },
      },
      db,
    );

    expect(db.development.create).not.toHaveBeenCalled();
  });

  it("does not add a second citation for an article already ingested", async () => {
    const db = createDb();
    db.developmentCitation.findUnique.mockResolvedValue(alreadyIngested);

    await citeKnowledgeDevelopment(
      {
        storylineId: "story-1",
        developmentId: "dev-1",
        dataSourceId: "ds-2",
        tickerIds: [],
        observedAt: "2026-07-06T00:00:00.000Z",
        anchors: ["telkom"],
      },
      db,
    );

    expect(db.developmentCitation.create).not.toHaveBeenCalled();
  });

  it("never offers a source that has already been ingested", async () => {
    const db = createDb();
    db.dataSource.findMany.mockResolvedValue([]);

    await listKnowledgeCandidateSources(undefined, 100, db);
    const args = db.dataSource.findMany.mock.calls[0]?.[0];

    expect(args.where.developmentCitations).toEqual({ none: {} });
  });
});

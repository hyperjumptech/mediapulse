/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSourceTickerSection: {
      findMany: vi.fn(),
    },
    ticker: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
    },
    newsletter: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    userTicker: {
      findMany: vi.fn(),
    },
  },
}));

import {
  createNewsletter,
  getDataSourcesForTicker,
  getLatestNewsletter,
  getRecentNewsletterBullets,
  getRecentNewsletterSubjects,
  updateFetchedContent,
} from "./content-generation.js";

type MockDb = {
  dataSourceTickerSection: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  ticker: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  newsletter: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  userTicker: {
    findMany: ReturnType<typeof vi.fn>;
  };
  domainAuthority: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  dataSourceTickerSection: {
    findMany: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  ticker: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  newsletter: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  userTicker: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  domainAuthority: {
    findMany: vi.fn().mockResolvedValue([]),
  },
});

type MockNewsletterDb = {
  newsletter: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  searchQuerySet: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const createMockNewsletterDb = (): MockNewsletterDb => ({
  newsletter: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  searchQuerySet: {
    findFirst: vi.fn().mockResolvedValue({ id: "set-active" }),
  },
});

type GetDataSourcesDeps = NonNullable<
  Parameters<typeof getDataSourcesForTicker>[1]
>;

describe("getDataSourcesForTicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters by classified section analyzed within the rolling lookback window and sorts by section score desc", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "TEST",
      name: "Test Company",
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([
      {
        section: "competitiveLandscape",
        sectionScore: 0.93,
        sectionReason: "peer move",
        dataSource: {
          id: "ds-high",
          url: "https://example.com/high",
          title: "High score",
          description: "High snippet",
          content: "High",
          author: null,
          source: "Reuters",
          searchQueryId: "sq-2",
          metadata: null,
          publishedAt: null,
        },
      },
      {
        section: "quickHits",
        sectionScore: 0.62,
        sectionReason: "minor",
        dataSource: {
          id: "ds-low",
          url: "https://example.com/low",
          title: "Low score",
          content: "Low",
          description: null,
          author: null,
          source: null,
          searchQueryId: null,
          metadata: null,
          publishedAt: null,
        },
      },
    ]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T15:30:00.000Z"),
    });

    // Assert — cutoff is 24h before `now`, not the UTC start of day.
    const expectedCutoff = new Date("2026-03-18T15:30:00.000Z");
    expect(db.dataSourceTickerSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tickerId: "ticker-1",
          section: { not: null },
          analyzedAt: { gte: expectedCutoff },
        },
        orderBy: { sectionScore: "desc" },
      }),
    );
    expect(result.dataSources).toHaveLength(2);
    expect(result.dataSources[0]?.title).toBe("High score");
    expect(result.dataSources[0]?.dataSourceId).toBe("ds-high");
    expect(result.dataSources[0]?.description).toBe("High snippet");
    expect(result.dataSources[0]?.tickerId).toBe("ticker-1");
    expect(result.dataSources[1]?.title).toBe("Low score");
    expect(result.dataSources[1]?.dataSourceId).toBe("ds-low");
    expect(result.dataSources[1]?.description).toBeNull();
    expect(result.tickerSymbol).toBe("TEST");
    expect(result.tickerName).toBe("Test Company");
  });

  it("includes an article analyzed during the prior UTC day (rolling-window regression)", async () => {
    // Setup — mirror the incident: a run at 02:00 UTC must still see the prior day's articles.
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "TEST",
      name: "Test Company",
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);

    // Act
    await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-07-01T02:00:00.000Z"),
    });

    // Assert — the cutoff reaches into the prior UTC day.
    const call = db.dataSourceTickerSection.findMany.mock.calls[0]?.[0];
    const cutoff = call?.where?.analyzedAt?.gte as Date;

    expect(cutoff).toEqual(new Date("2026-06-30T02:00:00.000Z"));

    // An article analyzed 06-30 03:48 UTC (as in the incident) is now inside the window, where the
    // old UTC-calendar-day boundary (00:00 UTC 07-01) would have excluded it.
    const priorDayAnalyzedAt = new Date("2026-06-30T03:48:00.000Z");
    const oldDayBoundary = new Date("2026-07-01T00:00:00.000Z");

    expect(priorDayAnalyzedAt.getTime()).toBeGreaterThanOrEqual(
      cutoff.getTime(),
    );
    expect(priorDayAnalyzedAt.getTime()).toBeLessThan(oldDayBoundary.getTime());
  });

  it("returns empty dataSources and ticker metadata when no articles exist within the lookback window", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "EMPTY",
      name: "Empty Corp",
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result.dataSources).toEqual([]);
    expect(result.tickerSymbol).toBe("EMPTY");
    expect(result.tickerName).toBe("Empty Corp");
  });

  it("returns distinct non-English subscriber languages", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "BBCA",
      name: "Bank Central Asia",
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);
    db.userTicker.findMany.mockResolvedValue([{ language: "id" }]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result.subscriberLanguages).toEqual(["id"]);
    expect(db.userTicker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "ticker-1", enabled: true, language: { not: "en" } },
        select: { language: true },
        distinct: ["language"],
      }),
    );
  });

  it("returns an empty subscriberLanguages list when there are no non-English subscribers", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "BBCA",
      name: "Bank Central Asia",
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);
    db.userTicker.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result.subscriberLanguages).toEqual([]);
  });
});

describe("createNewsletter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates newsletter with all provenance fields", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-1",
      tickerId: "ticker-1",
      subject: "Market Update",
      content: "Content body",
      model: "gpt-4o",
      agentVersion: "1.2.3",
      configVersion: "hermes-v3",
      promptHash: "abc12345",
      configSnapshotId: "snap-001",
      promptTokens: 512,
      completionTokens: 256,
      totalTokens: 768,
      createdAt,
      updatedAt,
    });

    // Act
    const result = await createNewsletter(
      {
        subject: "Market Update",
        content: "Content body",
        tickerId: "ticker-1",
        model: "gpt-4o",
        agentVersion: "1.2.3",
        configVersion: "hermes-v3",
        promptHash: "abc12345",
        configSnapshotId: "snap-001",
        promptTokens: 512,
        completionTokens: 256,
        totalTokens: 768,
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith({
      data: {
        subject: "Market Update",
        content: "Content body",
        tickerId: "ticker-1",
        searchQuerySetId: "set-active",
        model: "gpt-4o",
        agentVersion: "1.2.3",
        configVersion: "hermes-v3",
        promptHash: "abc12345",
        configSnapshotId: "snap-001",
        promptTokens: 512,
        completionTokens: 256,
        totalTokens: 768,
      },
    });
    expect(result.id).toBe("nl-1");
    expect(result.model).toBe("gpt-4o");
    expect(result.promptTokens).toBe(512);
  });

  it("creates newsletter without provenance fields (backward-compatible)", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-2",
      tickerId: "ticker-1",
      subject: "Simple Subject",
      content: "Simple content",
      model: null,
      agentVersion: null,
      configVersion: null,
      promptHash: null,
      configSnapshotId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      createdAt,
      updatedAt,
    });

    // Act
    await createNewsletter(
      {
        subject: "Simple Subject",
        content: "Simple content",
        tickerId: "ticker-1",
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith({
      data: {
        subject: "Simple Subject",
        content: "Simple content",
        tickerId: "ticker-1",
        searchQuerySetId: "set-active",
        model: null,
        agentVersion: null,
        configVersion: null,
        promptHash: null,
        configSnapshotId: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      },
    });
  });

  it("links the newsletter to the ticker's active query set, or null when none", async () => {
    const db = createMockNewsletterDb();
    db.newsletter.create.mockResolvedValue({ id: "nl-linked" });
    db.searchQuerySet.findFirst.mockResolvedValue(null);

    await createNewsletter(
      { subject: "s", content: "c", tickerId: "ticker-9" },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    expect(db.searchQuerySet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "ticker-9", isActive: true },
        orderBy: { generatedAt: "desc" },
      }),
    );
    expect(db.newsletter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ searchQuerySetId: null }),
      }),
    );
  });
});

describe("getLatestNewsletter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("returns hasNewsletter:true and newsletterId when a newsletter exists in the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue({
      id: "nl-123",
      createdAt: new Date("2026-04-20T02:00:00.000Z"),
    });

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T00:00:00.000Z",
      "2026-04-21T00:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result).toEqual({
      hasNewsletter: true,
      newsletterId: "nl-123",
      newsletterCreatedAt: "2026-04-20T02:00:00.000Z",
      analyzedSinceCount: 0,
    });
    expect(db.newsletter.findFirst).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        createdAt: {
          gte: new Date("2026-04-20T00:00:00.000Z"),
          lt: new Date("2026-04-21T00:00:00.000Z"),
        },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns hasNewsletter:false and null newsletterId when no newsletter exists in the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue(null);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T00:00:00.000Z",
      "2026-04-21T00:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result).toEqual({
      hasNewsletter: false,
      newsletterId: null,
      newsletterCreatedAt: null,
      analyzedSinceCount: 0,
    });
  });

  it("counts sections analyzed after the existing newsletter was written", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue({
      id: "nl-123",
      createdAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    db.dataSourceTickerSection.count.mockResolvedValue(7);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-08-04T17:00:00.000Z",
      "2026-08-05T17:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result.analyzedSinceCount).toBe(7);
    expect(result.newsletterCreatedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(db.dataSourceTickerSection.count).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        section: { not: null },
        analyzedAt: { gt: new Date("2026-08-05T00:00:00.000Z") },
      },
    });
  });

  it("does not count sections when no newsletter exists in the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue(null);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-08-04T17:00:00.000Z",
      "2026-08-05T17:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result.analyzedSinceCount).toBe(0);
    expect(db.dataSourceTickerSection.count).not.toHaveBeenCalled();
  });

  it("returns hasNewsletter:false when newsletter exists but outside the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue(null);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T17:00:00.000Z",
      "2026-04-21T17:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert — findFirst returns null because window filters out the old newsletter
    expect(result).toEqual({
      hasNewsletter: false,
      newsletterId: null,
      newsletterCreatedAt: null,
      analyzedSinceCount: 0,
    });
    expect(db.newsletter.findFirst).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        createdAt: {
          gte: new Date("2026-04-20T17:00:00.000Z"),
          lt: new Date("2026-04-21T17:00:00.000Z"),
        },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getRecentNewsletterSubjects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns subjects and createdAt for newsletters within the lookback window", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-20T12:00:00.000Z");
    db.newsletter.findMany.mockResolvedValue([
      { subject: "BCA profit up 12%", createdAt },
    ]);

    // Act
    const result = await getRecentNewsletterSubjects(
      "ticker-1",
      7,
      db as unknown as Parameters<typeof getRecentNewsletterSubjects>[2],
    );

    // Assert
    expect(result.items).toEqual([
      {
        subject: "BCA profit up 12%",
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(db.newsletter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId: "ticker-1",
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        select: { subject: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

describe("getRecentNewsletterBullets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flattens bullets from recent newsletters within the lookback window", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const document = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            {
              title: "Rival A underbids",
              url: "https://example.com/rival-a",
              points: ["Rival A underbid."],
            },
            {
              title: "Fleet oversupply",
              url: "https://example.com/fleet",
              points: ["Fleet oversupply."],
            },
          ],
        },
      ],
    });
    db.newsletter.findMany.mockResolvedValue([
      {
        id: "nl-1",
        content: document,
        createdAt: new Date("2026-04-20T12:00:00.000Z"),
      },
    ]);

    // Act
    const result = await getRecentNewsletterBullets(
      "ticker-1",
      14,
      db as unknown as Parameters<typeof getRecentNewsletterBullets>[2],
    );

    // Assert
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sectionKey)).toEqual([
      "competitiveLandscape",
      "competitiveLandscape",
    ]);
    expect(result.items[0]?.bulletText).toContain("Rival A underbid.");
    expect(result.items[0]?.newsletterId).toBe("nl-1");
    expect(db.newsletter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId: "ticker-1",
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

describe("getDataSourcesForTicker — competitors and issuerAliases from the profile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes competitors and aliases from the curated profile", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "BBCA",
      name: "Bank Central Asia",
      aliases: ["BCA"],
      profile: {
        aliases: ["PT Bank Central Asia Tbk"],
        competitors: [
          { name: "Bank Mandiri", aliases: ["BMRI"] },
          { name: "Bank Rakyat Indonesia", aliases: ["BBRI"] },
        ],
      },
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-bbca", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toEqual([
      { name: "Bank Mandiri", relation: "COMPETITOR" },
      { name: "Bank Rakyat Indonesia", relation: "COMPETITOR" },
    ]);
    expect(result.issuerAliases).toEqual([
      "BBCA",
      "Bank Central Asia",
      "BCA",
      "PT Bank Central Asia Tbk",
    ]);
  });

  it("returns no competitors and symbol/name aliases when the ticker has no profile", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "NEW",
      name: "New Company",
      aliases: [],
      profile: null,
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-new", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toEqual([]);
    expect(result.issuerAliases).toEqual(["NEW", "New Company"]);
    expect(result.tickerSymbol).toBe("NEW");
  });

  it("drops malformed competitor rows from the profile JSON", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "SOLO",
      name: "Solo Corp",
      aliases: [],
      profile: {
        aliases: [],
        competitors: [{ name: "" }, { aliases: ["X"] }, 42, null],
      },
    });
    db.dataSourceTickerSection.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-solo", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toEqual([]);
  });
});

describe("updateFetchedContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates each row with content, fetchedAt, and fetchProvider and returns the count", async () => {
    const update = vi.fn().mockResolvedValue({ id: "ds-1" });
    const db = { dataSource: { update } };
    const now = new Date("2026-07-13T00:00:00.000Z");

    const result = await updateFetchedContent(
      [
        { dataSourceId: "ds-1", content: "Body 1", fetchProvider: "serper" },
        { dataSourceId: "ds-2", content: "Body 2", fetchProvider: "tavily" },
      ],
      {
        db: db as unknown as NonNullable<
          Parameters<typeof updateFetchedContent>[1]
        >["db"],
        now: () => now,
      },
    );

    expect(result.updatedCount).toBe(2);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "ds-1" },
      data: { content: "Body 1", fetchedAt: now, fetchProvider: "serper" },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: "ds-2" },
      data: { content: "Body 2", fetchedAt: now, fetchProvider: "tavily" },
    });
  });

  it("backfills publishedAt only on rows that still have none", async () => {
    const update = vi.fn().mockResolvedValue({ id: "ds-1" });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { dataSource: { update, updateMany } };

    const result = await updateFetchedContent(
      [
        {
          dataSourceId: "ds-1",
          content: "Body 1",
          fetchProvider: "serper",
          publishedAt: "2026-08-05T02:00:00.000Z",
        },
        { dataSourceId: "ds-2", content: "Body 2", fetchProvider: "tavily" },
      ],
      {
        db: db as unknown as NonNullable<
          Parameters<typeof updateFetchedContent>[1]
        >["db"],
      },
    );

    expect(result.updatedCount).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "ds-1", publishedAt: null },
      data: { publishedAt: new Date("2026-08-05T02:00:00.000Z") },
    });
  });

  it("skips a row that fails to update without failing the batch", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error("row not found"))
      .mockResolvedValueOnce({ id: "ds-2" });
    const db = { dataSource: { update } };

    const result = await updateFetchedContent(
      [
        { dataSourceId: "ds-1", content: "Body 1", fetchProvider: "serper" },
        { dataSourceId: "ds-2", content: "Body 2", fetchProvider: "serper" },
      ],
      {
        db: db as unknown as NonNullable<
          Parameters<typeof updateFetchedContent>[1]
        >["db"],
      },
    );

    expect(result.updatedCount).toBe(1);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

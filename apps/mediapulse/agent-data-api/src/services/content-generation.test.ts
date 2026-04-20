/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
    newsletter: {
      create: vi.fn(),
    },
  },
}));

import {
  createNewsletter,
  getDataSourcesForTicker,
} from "./content-generation";

type MockDb = {
  dataSource: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  dataSource: {
    findMany: vi.fn(),
  },
});

type MockNewsletterDb = {
  newsletter: {
    create: ReturnType<typeof vi.fn>;
  };
};

const createMockNewsletterDb = (): MockNewsletterDb => ({
  newsletter: {
    create: vi.fn(),
  },
});

type GetDataSourcesDeps = NonNullable<
  Parameters<typeof getDataSourcesForTicker>[1]
>;

describe("getDataSourcesForTicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters by selected relevance scored today in UTC and sorts by score desc", async () => {
    // Setup
    const db = createMockDb();
    db.dataSource.findMany.mockResolvedValue([
      {
        id: "ds-low",
        url: "https://example.com/low",
        title: "Low score",
        content: "Low",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-1",
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
        updatedAt: new Date("2026-03-19T08:00:00.000Z"),
        articleRelevances: [{ score: 0.62 }],
      },
      {
        id: "ds-high",
        url: "https://example.com/high",
        title: "High score",
        content: "High",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-2",
        createdAt: new Date("2026-03-19T09:00:00.000Z"),
        updatedAt: new Date("2026-03-19T09:00:00.000Z"),
        articleRelevances: [{ score: 0.93 }],
      },
    ]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T15:30:00.000Z"),
    });

    // Assert
    const expectedStartOfToday = new Date("2026-03-19T00:00:00.000Z");
    expect(db.dataSource.findMany).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        articleRelevances: {
          some: {
            tickerId: "ticker-1",
            selected: true,
            scoredAt: { gte: expectedStartOfToday },
          },
        },
      },
      include: {
        articleRelevances: {
          where: {
            tickerId: "ticker-1",
            selected: true,
            scoredAt: { gte: expectedStartOfToday },
          },
          select: {
            score: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("ds-high");
    expect(result[1]?.id).toBe("ds-low");
    expect(result[0]).not.toHaveProperty("articleRelevances");
  });

  it("returns an empty array when no selected articles exist for today", async () => {
    // Setup
    const db = createMockDb();
    db.dataSource.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result).toEqual([]);
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
      description: null,
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
        description: null,
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
      description: null,
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
        description: null,
        content: "Simple content",
        tickerId: "ticker-1",
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

  it("passes description as null when omitted", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-3",
      tickerId: "ticker-1",
      subject: "No Desc Subject",
      description: null,
      content: "No desc content",
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
        subject: "No Desc Subject",
        content: "No desc content",
        tickerId: "ticker-1",
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
        }),
      }),
    );
  });
});

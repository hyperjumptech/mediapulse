import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_DATA_API_DEFAULT_VERSION,
  agentDataApiPathname,
} from "@workspace/agent-data-api-contract";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const SEARCH_QUERY_ID = "22222222-2222-4222-a222-222222222222";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };
const analysisPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "analysis",
);
const contentGenerationPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "contentGeneration",
);
const dataCollectionPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "dataCollection",
);
const dataCollectionExistingUrlsPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "dataCollectionExistingUrls",
);
const deliveryPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "delivery",
);
const queryAnalysisPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "queryAnalysis",
);
const deliveryRunPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "deliveryRun",
);
const NL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const contentGenerationV2Path = agentDataApiPathname("v2", "contentGeneration");
const contentGenerationNewslettersLatestPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "contentGenerationNewslettersLatest",
);

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env", () => ({
  env: {
    AGENT_AUTH_API_URL: "http://auth.example.com",
    MEDIAPULSE_DATABASE_URL: "postgresql://localhost/test?schema=mediapulse",
  },
}));

vi.mock("@mediapulse/database", () => ({
  prisma: {
    searchQuery: {
      findMany: vi.fn(),
    },
    searchQuerySet: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    ticker: {
      findUniqueOrThrow: vi.fn(),
    },
    tickerEntity: {
      findMany: vi.fn(),
    },
    dataSource: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./services/analysis.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./services/analysis.js")>();
  return {
    ...actual,
    loadAnalysisContext: vi.fn(),
    applyAnalysisPost: vi.fn(),
  };
});

vi.mock("./services/content-generation.js", () => ({
  getDataSourcesForTicker: vi.fn(),
  createNewsletter: vi.fn(),
  getLatestNewsletter: vi.fn(),
}));

vi.mock("./services/delivery.js", () => ({
  getDeliveryData: vi.fn(),
  postDelivery: vi.fn(),
}));

vi.mock("./services/delivery-run.js", () => ({
  listDeliveryRuns: vi.fn(),
  createDeliveryRun: vi.fn(),
}));

const getAnalysisService = () => import("./services/analysis.js");
const getContentGenerationService = () =>
  import("./services/content-generation.js");
const getDeliveryService = () => import("./services/delivery.js");
const getDeliveryRunService = () => import("./services/delivery-run.js");
const getDatabase = () => import("@mediapulse/database");

describe("agent-data-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe(`GET ${contentGenerationPath}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationPath}?tickerId=${TICKER_ID}`,
      );
      expect(res.status).toBe(401);
    }, 20_000);

    it("returns 200 and dataSources when service returns data", async () => {
      const mod = await getContentGenerationService();
      vi.mocked(mod.getDataSourcesForTicker).mockResolvedValue([
        {
          id: "ds-1",
          url: "https://example.com",
          title: "Example",
          content: "Content",
          metadata: null,
          tickerId: TICKER_ID,
          searchQueryId: SEARCH_QUERY_ID,
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          updatedAt: new Date("2026-03-19T00:00:00.000Z"),
        },
      ]);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("dataSources");
      expect(body.dataSources).toHaveLength(1);
      expect(body.dataSources[0].title).toBe("Example");
    });

    it("returns 400 when query validation fails (missing tickerId)", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationPath}`,
        {
          headers: AUTH_HEADERS,
        },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Bad Request");
      expect(body.errors).toBeDefined();
    });
  });

  describe(`GET ${contentGenerationV2Path}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationV2Path}?tickerId=${TICKER_ID}`,
      );
      expect(res.status).toBe(401);
    }, 20_000);
  });

  describe(`GET ${contentGenerationNewslettersLatestPath}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationNewslettersLatestPath}?tickerId=${TICKER_ID}&windowStart=2026-04-20T00:00:00.000Z&windowEnd=2026-04-21T00:00:00.000Z`,
      );
      expect(res.status).toBe(401);
    });

    it("returns hasNewsletter:true when a newsletter exists in the window", async () => {
      const mod = await getContentGenerationService();
      vi.mocked(mod.getLatestNewsletter).mockResolvedValue({
        hasNewsletter: true,
        newsletterId: "nl-123",
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationNewslettersLatestPath}?tickerId=${TICKER_ID}&windowStart=2026-04-20T00:00:00.000Z&windowEnd=2026-04-21T00:00:00.000Z`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.hasNewsletter).toBe(true);
      expect(body.newsletterId).toBe("nl-123");
      expect(mod.getLatestNewsletter).toHaveBeenCalledWith(
        TICKER_ID,
        "2026-04-20T00:00:00.000Z",
        "2026-04-21T00:00:00.000Z",
      );
    });

    it("returns hasNewsletter:false when no newsletter exists in the window", async () => {
      const mod = await getContentGenerationService();
      vi.mocked(mod.getLatestNewsletter).mockResolvedValue({
        hasNewsletter: false,
        newsletterId: null,
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationNewslettersLatestPath}?tickerId=${TICKER_ID}&windowStart=2026-04-20T00:00:00.000Z&windowEnd=2026-04-21T00:00:00.000Z`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.hasNewsletter).toBe(false);
      expect(body.newsletterId).toBeNull();
    });

    it("returns 400 when query validation fails (missing tickerId)", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationNewslettersLatestPath}?windowStart=2026-04-20T00:00:00.000Z&windowEnd=2026-04-21T00:00:00.000Z`,
        { headers: AUTH_HEADERS },
      );
      expect(res.status).toBe(400);
    });
  });

  describe(`POST ${contentGenerationPath}`, () => {
    it("returns 200 and Success when body is valid", async () => {
      const mod = await getContentGenerationService();
      vi.mocked(mod.createNewsletter).mockResolvedValue({
        id: "newsletter-1",
        tickerId: TICKER_ID,
        subject: "Test Subject",
        description: null,
        content: "Test content",
        model: null,
        agentVersion: null,
        configVersion: null,
        promptHash: null,
        configSnapshotId: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationPath}`,
        {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: "Test Subject",
            content: "Test content",
            tickerId: TICKER_ID,
          }),
        },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
    });

    it("returns 200 when body includes provenance fields", async () => {
      const mod = await getContentGenerationService();
      vi.mocked(mod.createNewsletter).mockResolvedValue({
        id: "newsletter-2",
        tickerId: TICKER_ID,
        subject: "Provenance Subject",
        description: null,
        content: "Provenance content",
        model: "gpt-4o",
        agentVersion: "1.2.3",
        configVersion: "hermes-v3",
        promptHash: "abc12345",
        configSnapshotId: "snap-001",
        promptTokens: 512,
        completionTokens: 256,
        totalTokens: 768,
        createdAt: new Date("2026-04-14T00:00:00.000Z"),
        updatedAt: new Date("2026-04-14T00:00:00.000Z"),
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${contentGenerationPath}`,
        {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: "Provenance Subject",
            content: "Provenance content",
            tickerId: TICKER_ID,
            model: "gpt-4o",
            agentVersion: "1.2.3",
            configVersion: "hermes-v3",
            promptHash: "abc12345",
            configSnapshotId: "snap-001",
            promptTokens: 512,
            completionTokens: 256,
            totalTokens: 768,
          }),
        },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
      expect(vi.mocked(mod.createNewsletter)).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          agentVersion: "1.2.3",
          configVersion: "hermes-v3",
          promptHash: "abc12345",
          configSnapshotId: "snap-001",
          promptTokens: 512,
          completionTokens: 256,
          totalTokens: 768,
        }),
      );
    });
  });

  describe(`GET ${analysisPath}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${analysisPath}?tickerId=${TICKER_ID}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 200 with analysis context when service returns data", async () => {
      const mod = await getAnalysisService();
      vi.mocked(mod.loadAnalysisContext).mockResolvedValue({
        dataSources: [
          {
            id: "33333333-3333-4333-a333-333333333333",
            url: "https://example.com",
            title: "Example",
            content: "Body",
            tickerId: TICKER_ID,
            createdAt: new Date("2026-03-19T00:00:00.000Z"),
          },
        ],
        dataSourceTotalCount: 1,
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState: {
          utcDayStartIso: "2026-03-19T00:00:00.000Z",
          selectedCountToday: 0,
        },
        lastRelevanceScoredAtIso: null,
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${analysisPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.dataSources).toHaveLength(1);
      expect(mod.loadAnalysisContext).toHaveBeenCalledWith({
        tickerId: TICKER_ID,
        unanalyzed: true,
      });
    });

    it("forwards start and end query params to loadAnalysisContext", async () => {
      const mod = await getAnalysisService();
      vi.mocked(mod.loadAnalysisContext).mockResolvedValue({
        dataSources: [],
        dataSourceTotalCount: 0,
        entityTypes: [],
        relationTypes: [],
        existingEntities: [],
        relevanceSelectionState: {
          utcDayStartIso: "2026-03-19T00:00:00.000Z",
          selectedCountToday: 0,
        },
        lastRelevanceScoredAtIso: null,
      });

      const start = "2026-01-01T00:00:00.000Z";
      const end = "2026-01-31T00:00:00.000Z";
      const qs = new URLSearchParams({
        tickerId: TICKER_ID,
        unanalyzed: "true",
        start,
        end,
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${analysisPath}?${qs.toString()}`,
        { headers: AUTH_HEADERS },
      );

      expect(res.status).toBe(200);
      expect(mod.loadAnalysisContext).toHaveBeenCalledWith({
        tickerId: TICKER_ID,
        unanalyzed: true,
        start,
        end,
      });
    });
  });

  describe(`POST ${analysisPath}`, () => {
    it("returns 400 when applyAnalysisPost rejects validation", async () => {
      const mod = await getAnalysisService();
      vi.mocked(mod.applyAnalysisPost).mockRejectedValue(
        new mod.AnalysisPostValidationError("bad data source"),
      );

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${analysisPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          tickerId: TICKER_ID,
          entities: [],
          relations: [],
          articleEntities: [],
          articleRelevances: [],
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("bad data source");
    });

    it("returns 200 with counts when body is valid", async () => {
      const mod = await getAnalysisService();
      vi.mocked(mod.applyAnalysisPost).mockResolvedValue({
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 0,
      });

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${analysisPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          tickerId: TICKER_ID,
          entities: [],
          relations: [],
          articleEntities: [],
          articleRelevances: [
            {
              dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              score: 0.5,
              scoreBreakdown: {
                _version: 1,
                breakingNews: 0.5,
                kgRelation: 0.5,
                fundamental: 0.5,
                tickerSalience: 0.5,
                sourceQuality: 0.5,
              },
              selected: false,
            },
          ],
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.entitiesCreated).toBe(1);
      expect(body.articlesScored).toBe(1);
    });
  });

  describe(`GET ${dataCollectionPath}`, () => {
    it("returns 200 and data when service returns data", async () => {
      const { prisma } = await getDatabase();
      vi.mocked(prisma.searchQuery.findMany).mockResolvedValue([
        {
          id: "sq-1",
          text: "query one",
          tickerId: TICKER_ID,
          setId: null,
          source: "deterministic",
          intent: "breaking",
          rank: 1,
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          updatedAt: new Date("2026-03-19T00:00:00.000Z"),
        },
      ]);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${dataCollectionPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveLength(1);
      expect(body.data[0].text).toBe("query one");
      expect(prisma.searchQuery.findMany).toHaveBeenCalledWith({
        where: {
          tickerId: TICKER_ID,
          set: { isActive: true },
        },
      });
    });
  });

  describe(`GET ${queryAnalysisPath}`, () => {
    it("returns ticker context", async () => {
      // Setup
      const { prisma } = await getDatabase();
      vi.mocked(prisma.ticker.findUniqueOrThrow).mockResolvedValue({
        id: TICKER_ID,
        symbol: "AAPL",
        name: "Apple Inc.",
        metadata: null,
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      });
      vi.mocked(prisma.tickerEntity.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dataSource.findMany).mockResolvedValue([]);

      // Act
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${queryAnalysisPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.ticker.symbol).toBe("AAPL");
      expect(body.topEntities).toEqual([]);
      expect(body.recentThemes).toEqual([]);
    });
  });

  describe(`POST ${queryAnalysisPath}`, () => {
    it("creates and activates a query set", async () => {
      // Setup
      const { prisma } = await getDatabase();
      vi.mocked(prisma.searchQuerySet.updateMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.searchQuerySet.create).mockResolvedValue({
        id: "33333333-3333-4333-a333-333333333333",
        tickerId: TICKER_ID,
        generatedAt: new Date("2026-03-20T00:00:00.000Z"),
        isActive: true,
        strategySnapshot: {},
        generationSource: "hybrid_v1",
        agentJobId: null,
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      });

      // Act
      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${queryAnalysisPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          tickerId: TICKER_ID,
          generationSource: "hybrid_v1",
          strategySnapshot: { queryCount: 10 },
          activate: true,
          queries: [
            {
              text: "AAPL latest news",
              source: "deterministic",
              intent: "breaking",
              rank: 1,
            },
          ],
        }),
      });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(body.created).toBe(1);
      expect(body.createdSetId).toBe("33333333-3333-4333-a333-333333333333");
      expect(prisma.searchQuerySet.updateMany).toHaveBeenCalledOnce();
      expect(prisma.searchQuerySet.create).toHaveBeenCalledOnce();
    });
  });

  describe(`POST ${dataCollectionPath}`, () => {
    it("returns 200 when body is valid array with tickerId + searchQueryId per item", async () => {
      const { prisma } = await getDatabase();
      vi.mocked(prisma.dataSource.createMany).mockResolvedValue({ count: 1 });

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${dataCollectionPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            url: "https://example.com",
            title: "Example",
            content: "Content",
            tickerId: TICKER_ID,
            searchQueryId: SEARCH_QUERY_ID,
          },
        ]),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
      expect(prisma.dataSource.createMany).toHaveBeenCalledWith({
        data: [
          {
            url: "https://example.com",
            title: "Example",
            content: "Content",
            tickerId: TICKER_ID,
            searchQueryId: SEARCH_QUERY_ID,
          },
        ],
      });
    });
  });

  describe(`POST ${dataCollectionExistingUrlsPath}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${dataCollectionExistingUrlsPath}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tickerId: TICKER_ID,
            urls: ["https://example.com"],
          }),
        },
      );
      expect(res.status).toBe(401);
    }, 20_000);

    it("returns 400 when body validation fails (missing urls)", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${dataCollectionExistingUrlsPath}`,
        {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ tickerId: TICKER_ID }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("returns 200 with empty existingUrls when urls is empty", async () => {
      const { prisma } = await getDatabase();

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${dataCollectionExistingUrlsPath}`,
        {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ tickerId: TICKER_ID, urls: [] }),
        },
      );
      const body = (await res.json()) as { existingUrls: string[] };

      expect(res.status).toBe(200);
      expect(body.existingUrls).toEqual([]);
      expect(prisma.dataSource.findMany).not.toHaveBeenCalled();
    });

    it("returns 200 with URLs that exist for the ticker", async () => {
      const { prisma } = await getDatabase();
      vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
        { url: "https://exists.example/a" },
        { url: "https://exists.example/a" },
      ] as never);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${dataCollectionExistingUrlsPath}`,
        {
          method: "POST",
          headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({
            tickerId: TICKER_ID,
            urls: ["https://exists.example/a", "https://new.example/b"],
          }),
        },
      );
      const body = (await res.json()) as { existingUrls: string[] };

      expect(res.status).toBe(200);
      expect(body.existingUrls).toEqual(["https://exists.example/a"]);
      expect(prisma.dataSource.findMany).toHaveBeenCalledWith({
        where: {
          tickerId: TICKER_ID,
          url: {
            in: ["https://exists.example/a", "https://new.example/b"],
          },
        },
        select: { url: true },
      });
    });
  });

  describe(`GET ${deliveryPath}`, () => {
    it("returns 200 with null newsletter when none exists", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.getDeliveryData).mockResolvedValue({
        newsletter: null,
        subscribers: [],
        deliveredUserTickerIds: [],
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${deliveryPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.newsletter).toBeNull();
      expect(body.deliveredUserTickerIds).toEqual([]);
    });

    it("returns 200 and newsletter + subscribers when data exists", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.getDeliveryData).mockResolvedValue({
        newsletter: {
          subject: "News",
          content: "Body",
          id: NL_ID,
        },
        subscribers: [{ userTickerId: UT_ID, email: "u@example.com" }],
        deliveredUserTickerIds: [],
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${deliveryPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.newsletter.subject).toBe("News");
      expect(body.subscribers).toHaveLength(1);
      expect(body.subscribers[0].email).toBe("u@example.com");
      expect(body.subscribers[0].userTickerId).toBe(UT_ID);
    });
  });

  describe(`POST ${deliveryPath}`, () => {
    it("returns 200 when body has userTickerId and newsletterId", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.postDelivery).mockResolvedValue(undefined);

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${deliveryPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ userTickerId: UT_ID, newsletterId: NL_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
    });
  });

  describe(`GET ${deliveryRunPath}`, () => {
    it("returns 200 with data array", async () => {
      const mod = await getDeliveryRunService();
      vi.mocked(mod.listDeliveryRuns).mockResolvedValue([
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          agentId: "delivery",
          agentVersion: "1.0.0",
          tickerId: TICKER_ID,
          newsletterId: NL_ID,
          outcome: "success",
          stage: "persist_delivery_record",
          successCount: 1,
          failureCount: 0,
          skippedCount: 0,
          durationMs: 100,
          scheduleExecutionId: null,
          hermesScheduleId: null,
          pipelineStepId: null,
          jobId: null,
          hermesExecutionId: null,
          runSkipReason: null,
          recipientErrorSummary: null,
          resendMessageIds: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          ticker: { symbol: "ACME" },
        },
      ] as never);

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${deliveryRunPath}`, {
        headers: AUTH_HEADERS,
      });
      const body = (await res.json()) as {
        data: Array<{ tickerSymbol?: string }>;
      };

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.tickerSymbol).toBe("ACME");
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_DATA_API_DEFAULT_VERSION,
  agentDataApiPathname,
} from "@workspace/agent-data-api-contract";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const SEARCH_QUERY_ID = "22222222-2222-4222-a222-222222222222";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };
const contentGenerationPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "contentGeneration",
);
const dataCollectionPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "dataCollection",
);
const deliveryPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "delivery",
);
const queryAnalysisPath = agentDataApiPathname(
  AGENT_DATA_API_DEFAULT_VERSION,
  "queryAnalysis",
);
const contentGenerationV2Path = agentDataApiPathname("v2", "contentGeneration");

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
    dataSource: {
      createMany: vi.fn(),
    },
    searchQuerySet: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("./services/content-generation.js", () => ({
  getDataSourcesForTicker: vi.fn(),
  createNewsletter: vi.fn(),
}));

vi.mock("./services/delivery.js", () => ({
  getDeliveryData: vi.fn(),
  postDelivery: vi.fn(),
}));

vi.mock("./services/query-analysis.js", () => ({
  getQueryAnalysisContext: vi.fn(),
  persistQuerySet: vi.fn(),
}));

const getContentGenerationService = () =>
  import("./services/content-generation.js");
const getDeliveryService = () => import("./services/delivery.js");
const getQueryAnalysisService = () => import("./services/query-analysis.js");
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
    });

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
  });

  describe(`GET ${dataCollectionPath}`, () => {
    it("returns 200 and data when service returns data", async () => {
      const { prisma: db } = await getDatabase();
      vi.mocked(db.searchQuerySet.findFirst).mockResolvedValue(null);
      vi.mocked(db.searchQuery.findMany).mockResolvedValue([
        {
          id: "sq-1",
          text: "query one",
          tickerId: TICKER_ID,
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

  describe(`GET ${deliveryPath}`, () => {
    it("returns 404 when no newsletter exists", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.getDeliveryData).mockResolvedValue(null);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${deliveryPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.message).toContain("newsletter");
    });

    it("returns 200 and newsletter + subscribers when data exists", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.getDeliveryData).mockResolvedValue({
        newsletter: {
          subject: "News",
          content: "Body",
          id: "n1",
          tickerId: TICKER_ID,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        subscribers: [{ email: "u@example.com" }],
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
    });
  });

  describe(`POST ${deliveryPath}`, () => {
    it("returns 200 when body has userTickerId", async () => {
      const mod = await getDeliveryService();
      vi.mocked(mod.postDelivery).mockResolvedValue(undefined);

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${deliveryPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ userTickerId: TICKER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
    });
  });

  describe(`GET ${queryAnalysisPath}`, () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${queryAnalysisPath}?tickerId=${TICKER_ID}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 when ticker is not found", async () => {
      const mod = await getQueryAnalysisService();
      vi.mocked(mod.getQueryAnalysisContext).mockResolvedValue(null);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${queryAnalysisPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );

      expect(res.status).toBe(404);
    });

    it("returns 200 with ticker context when ticker exists", async () => {
      const mod = await getQueryAnalysisService();
      vi.mocked(mod.getQueryAnalysisContext).mockResolvedValue({
        ticker: {
          id: TICKER_ID,
          symbol: "AAPL",
          name: "Apple Inc.",
          metadata: null,
        },
        topEntities: [
          {
            canonicalName: "Tim Cook",
            typeName: "Person",
            relevanceWeight: 0.9,
          },
        ],
        recentThemes: [{ theme: "iPhone", articleCount: 5 }],
      });

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost${queryAnalysisPath}?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ticker.symbol).toBe("AAPL");
      expect(body.topEntities).toHaveLength(1);
      expect(body.recentThemes).toHaveLength(1);
    });

    it("returns 400 when tickerId is missing", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${queryAnalysisPath}`, {
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(400);
    });
  });

  describe(`POST ${queryAnalysisPath}`, () => {
    it("returns 200 with set ids when body is valid", async () => {
      const mod = await getQueryAnalysisService();
      vi.mocked(mod.persistQuerySet).mockResolvedValue({
        created: 2,
        setId: "33333333-3333-4333-a333-333333333333",
        activeSetId: "33333333-3333-4333-a333-333333333333",
      });

      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${queryAnalysisPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          tickerId: TICKER_ID,
          queries: [
            {
              text: "AAPL latest news",
              source: "deterministic",
              intent: "breaking",
              rank: 1,
            },
          ],
          strategySnapshot: { queryCount: 12 },
          generationSource: "hybrid_v1",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.created).toBe(2);
      expect(body.setId).toBe("33333333-3333-4333-a333-333333333333");
      expect(body.activeSetId).toBe("33333333-3333-4333-a333-333333333333");
    });

    it("returns 400 when body is missing required fields", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(`http://localhost${queryAnalysisPath}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ tickerId: TICKER_ID }),
      });
      expect(res.status).toBe(400);
    });
  });
});

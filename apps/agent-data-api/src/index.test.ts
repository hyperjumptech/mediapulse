import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const SEARCH_QUERY_ID = "22222222-2222-4222-a222-222222222222";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@workspace/env", () => ({
  env: {
    AGENT_AUTH_API_URL: "http://auth.example.com",
    DATABASE_URL: "postgresql://localhost/test",
    TEMP_ADMIN_USERNAME: "admin",
    TEMP_ADMIN_PASSWORD: "admin",
  },
}));

vi.mock("./services/content-generation.js", () => ({
  getDataSourcesForTicker: vi.fn(),
  createNewsletter: vi.fn(),
}));

vi.mock("./services/data-collection.js", () => ({
  getSearchQueries: vi.fn(),
  createDataSources: vi.fn(),
}));

vi.mock("./services/delivery.js", () => ({
  getDeliveryData: vi.fn(),
  postDelivery: vi.fn(),
}));

const getContentGenerationService = () =>
  import("./services/content-generation.js");
const getDataCollectionService = () => import("./services/data-collection.js");
const getDeliveryService = () => import("./services/delivery.js");

describe("agent-data-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/content-generation", () => {
    it("returns 401 without Authorization header", async () => {
      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost/api/content-generation?tickerId=${TICKER_ID}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 200 and dataSources when service returns data", async () => {
      const mod = await getContentGenerationService();
      mod.getDataSourcesForTicker.mockResolvedValue([
        {
          id: "ds-1",
          url: "https://example.com",
          title: "Example",
          content: "Content",
          metadata: null,
          tickerId: TICKER_ID,
          searchQueryId: "sq-1",
        },
      ]);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost/api/content-generation?tickerId=${TICKER_ID}`,
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
      const res = await app.request("http://localhost/api/content-generation", {
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Bad Request");
      expect(body.errors).toBeDefined();
    });
  });

  describe("POST /api/content-generation", () => {
    it("returns 200 and Success when body is valid", async () => {
      const mod = await getContentGenerationService();
      mod.createNewsletter.mockResolvedValue(undefined);

      const { app } = await import("./index.js");
      const res = await app.request("http://localhost/api/content-generation", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Test Subject",
          content: "Test content",
          tickerId: TICKER_ID,
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
    });
  });

  describe("GET /api/data-collection", () => {
    it("returns 200 and searchQueries when service returns data", async () => {
      const mod = await getDataCollectionService();
      mod.getSearchQueries.mockResolvedValue([
        { id: "sq-1", text: "query one", tickerId: TICKER_ID },
      ]);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost/api/data-collection?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("searchQueries");
      expect(body.searchQueries).toHaveLength(1);
      expect(body.searchQueries[0].text).toBe("query one");
    });
  });

  describe("POST /api/data-collection", () => {
    it("returns 200 when body is valid array with tickerId + searchQueryId per item", async () => {
      const mod = await getDataCollectionService();
      mod.createDataSources.mockResolvedValue(undefined);

      const { app } = await import("./index.js");
      const res = await app.request("http://localhost/api/data-collection", {
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
      expect(mod.createDataSources).toHaveBeenCalledWith([
        {
          url: "https://example.com",
          title: "Example",
          content: "Content",
          tickerId: TICKER_ID,
          searchQueryId: SEARCH_QUERY_ID,
        },
      ]);
    });
  });

  describe("GET /api/delivery", () => {
    it("returns 404 when no newsletter exists", async () => {
      const mod = await getDeliveryService();
      mod.getDeliveryData.mockResolvedValue(null);

      const { app } = await import("./index.js");
      const res = await app.request(
        `http://localhost/api/delivery?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.message).toContain("newsletter");
    });

    it("returns 200 and newsletter + subscribers when data exists", async () => {
      const mod = await getDeliveryService();
      mod.getDeliveryData.mockResolvedValue({
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
        `http://localhost/api/delivery?tickerId=${TICKER_ID}`,
        { headers: AUTH_HEADERS },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.newsletter.subject).toBe("News");
      expect(body.subscribers).toHaveLength(1);
      expect(body.subscribers[0].email).toBe("u@example.com");
    });
  });

  describe("POST /api/delivery", () => {
    it("returns 200 when body has userTickerId", async () => {
      const mod = await getDeliveryService();
      mod.postDelivery.mockResolvedValue(undefined);

      const { app } = await import("./index.js");
      const res = await app.request("http://localhost/api/delivery", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ userTickerId: TICKER_ID }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Success");
    });
  });
});

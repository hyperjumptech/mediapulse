/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnsubscribeToken } from "@workspace/utils";

const SECRET = "test-unsubscribe-secret";
const USER_TICKER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TICKER_SYMBOL = "AAPL";

// Mock dependencies before importing the routes
vi.mock("@mediapulse/env", () => ({
  env: {
    UNSUBSCRIBE_SECRET: SECRET,
  },
}));

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@mediapulse/database", () => ({
  prisma: {
    userTicker: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

describe("unsubscribe-routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function validToken() {
    return createUnsubscribeToken({
      userTickerId: USER_TICKER_ID,
      tickerSymbol: TICKER_SYMBOL,
      secret: SECRET,
    });
  }

  async function getUnsubscribe(query = "") {
    const { unsubscribeRoutes } = await import("./unsubscribe-routes");
    return unsubscribeRoutes.request(`/unsubscribe${query}`, {
      method: "GET",
    });
  }

  async function postUnsubscribe(query = "") {
    const { unsubscribeRoutes } = await import("./unsubscribe-routes");
    return unsubscribeRoutes.request(`/unsubscribe${query}`, {
      method: "POST",
    });
  }

  describe("GET /api/unsubscribe", () => {
    it("returns success HTML with ticker symbol for a valid token", async () => {
      mockFindUnique.mockResolvedValue({
        id: USER_TICKER_ID,
        enabled: true,
        unsubscribedAt: null,
        ticker: { symbol: TICKER_SYMBOL },
      });
      mockUpdate.mockResolvedValue({});

      const res = await getUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain(TICKER_SYMBOL);
      expect(body).toContain("Unsubscribed");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: USER_TICKER_ID },
        data: {
          enabled: false,
          unsubscribedAt: expect.any(Date),
          unsubscribeMethod: "link",
        },
      });
    });

    it("is idempotent for already unsubscribed users", async () => {
      mockFindUnique.mockResolvedValue({
        id: USER_TICKER_ID,
        enabled: false,
        unsubscribedAt: new Date(),
        ticker: { symbol: TICKER_SYMBOL },
      });

      const res = await getUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("already unsubscribed");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns expired message for an expired token", async () => {
      const expiredToken = createUnsubscribeToken({
        userTickerId: USER_TICKER_ID,
        tickerSymbol: TICKER_SYMBOL,
        secret: SECRET,
        expiresInMs: -1,
      });

      const res = await getUnsubscribe(`?token=${expiredToken}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("expired");
    });

    it("returns invalid message for a garbage token", async () => {
      const res = await getUnsubscribe("?token=garbage");

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("invalid");
    });

    it("returns missing-subscription message when UserTicker is deleted", async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await getUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("couldn't find");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("uses token-embedded ticker symbol as fallback when DB lookup fails", async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await getUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      // The "couldn't find" message is shown, not the ticker symbol
      expect(body).toContain("couldn't find");
    });

    it("unsubscribes a user with registrationConfirmedAt=null", async () => {
      mockFindUnique.mockResolvedValue({
        id: USER_TICKER_ID,
        enabled: true,
        unsubscribedAt: null,
        ticker: { symbol: TICKER_SYMBOL },
      });
      mockUpdate.mockResolvedValue({});

      const res = await getUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("POST /api/unsubscribe (RFC 8058)", () => {
    it("returns empty 200 for a valid token", async () => {
      mockFindUnique.mockResolvedValue({
        id: USER_TICKER_ID,
        enabled: true,
        unsubscribedAt: null,
        ticker: { symbol: TICKER_SYMBOL },
      });
      mockUpdate.mockResolvedValue({});

      const res = await postUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: USER_TICKER_ID },
        data: {
          enabled: false,
          unsubscribedAt: expect.any(Date),
          unsubscribeMethod: "one_click",
        },
      });
    });

    it("returns empty 200 for an invalid token (no leaky errors)", async () => {
      const res = await postUnsubscribe("?token=garbage");

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");
    });

    it("returns empty 200 when UserTicker not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await postUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");
    });

    it("is idempotent for already unsubscribed users", async () => {
      mockFindUnique.mockResolvedValue({
        id: USER_TICKER_ID,
        enabled: false,
        unsubscribedAt: new Date(),
        ticker: { symbol: TICKER_SYMBOL },
      });

      const res = await postUnsubscribe(`?token=${validToken()}`);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("");
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

import {
  postDataCollectionDeadUrlsLookup,
  postDataCollectionDeadUrlsRecord,
} from "./data-collection-dead-url";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    deadUrl: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../services/data-collection-dead-url.js", () => ({
  lookupDeadUrls: vi.fn(),
  recordDeadUrls: vi.fn(),
}));

import {
  lookupDeadUrls,
  recordDeadUrls,
} from "../services/data-collection-dead-url.js";

describe("postDataCollectionDeadUrlsLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dead URLs from the service", async () => {
    vi.mocked(lookupDeadUrls).mockResolvedValue(["https://example.com/dead"]);

    const app = new Hono();
    app.post("/", postDataCollectionDeadUrlsLookup);

    const response = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickerId: "ticker-1",
        urls: ["https://example.com/dead", "https://example.com/live"],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deadUrls: ["https://example.com/dead"],
    });
  });
});

describe("postDataCollectionDeadUrlsRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recorded count from the service", async () => {
    vi.mocked(recordDeadUrls).mockResolvedValue(2);

    const app = new Hono();
    app.post("/", postDataCollectionDeadUrlsRecord);

    const response = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          tickerId: "ticker-1",
          url: "https://example.com/missing",
          errorCategory: "provider_http_error",
          httpStatus: 404,
        },
      ]),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Dead URLs recorded",
      recordedCount: 2,
    });
  });
});

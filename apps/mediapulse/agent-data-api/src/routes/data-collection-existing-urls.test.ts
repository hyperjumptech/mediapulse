/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@mediapulse/database";

import { postDataCollectionExistingUrls } from "./data-collection-existing-urls";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

describe("postDataCollectionExistingUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns host counts when urls is empty", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValueOnce([
      { url: "https://exists.example/page" },
    ] as never);

    const app = new Hono();
    app.post("/test", postDataCollectionExistingUrls);

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickerId: TICKER_ID, urls: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      existingUrls: [],
      hostCounts: { "exists.example": 1 },
    });
    expect(prisma.dataSource.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns 200 with URLs returned by prisma for the ticker", async () => {
    vi.mocked(prisma.dataSource.findMany)
      .mockResolvedValueOnce([{ url: "https://exists.example/other" }] as never)
      .mockResolvedValueOnce([
        { url: "https://exists.example" },
        { url: "https://exists.example" },
      ] as never);

    const app = new Hono();
    app.post("/test", postDataCollectionExistingUrls);

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickerId: TICKER_ID,
        urls: ["https://exists.example", "https://new.example"],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      existingUrls: string[];
      hostCounts: Record<string, number>;
    };
    expect(body.existingUrls).toEqual(["https://exists.example"]);
    expect(body.hostCounts).toEqual({ "exists.example": 1 });
    expect(prisma.dataSource.findMany).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when body fails schema validation", async () => {
    const app = new Hono();
    app.post("/test", postDataCollectionExistingUrls);

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickerId: TICKER_ID }),
    });

    expect(res.status).toBe(400);
  });
});

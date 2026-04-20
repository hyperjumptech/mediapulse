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

  it("returns 200 with empty existingUrls without querying when urls is empty", async () => {
    const app = new Hono();
    app.post("/test", postDataCollectionExistingUrls);

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickerId: TICKER_ID, urls: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ existingUrls: [] });
    expect(prisma.dataSource.findMany).not.toHaveBeenCalled();
  });

  it("returns 200 with URLs returned by prisma for the ticker", async () => {
    vi.mocked(prisma.dataSource.findMany).mockResolvedValue([
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
    const body = (await res.json()) as { existingUrls: string[] };
    expect(body.existingUrls).toEqual(["https://exists.example"]);
    expect(prisma.dataSource.findMany).toHaveBeenCalledWith({
      where: {
        tickerId: TICKER_ID,
        url: {
          in: ["https://exists.example", "https://new.example"],
        },
      },
      select: { url: true },
    });
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

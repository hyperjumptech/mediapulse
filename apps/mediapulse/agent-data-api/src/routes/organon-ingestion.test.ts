/** @vitest-environment node */
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));
vi.mock("../services/organon-ingestion.js", () => ({
  listOrganonIngestionCandidates: vi.fn(),
  recordOrganonIngestionSends: vi.fn(),
  claimOrganonIngestionRetries: vi.fn(),
}));

import {
  claimOrganonIngestionRetries,
  listOrganonIngestionCandidates,
  recordOrganonIngestionSends,
} from "../services/organon-ingestion.js";
import {
  getOrganonIngestionCandidatesHandler,
  postOrganonIngestionRetriesHandler,
  postOrganonIngestionSendsHandler,
} from "./organon-ingestion.js";

const createApp = () => {
  const app = new Hono();
  app.get("/candidates", getOrganonIngestionCandidatesHandler);
  app.post("/sends", postOrganonIngestionSendsHandler);
  app.post("/retries", postOrganonIngestionRetriesHandler);

  return app;
};

const postJson = (app: Hono, path: string, body: unknown) =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("organon ingestion routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists candidates with the default lookback and take", async () => {
    vi.mocked(listOrganonIngestionCandidates).mockResolvedValue({
      candidates: [],
    });

    const response = await createApp().request(
      "http://localhost/candidates?sendFrom=2026-11-10T00:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ candidates: [] });
    expect(listOrganonIngestionCandidates).toHaveBeenCalledWith(
      expect.anything(),
      { sendFrom: "2026-11-10T00:00:00.000Z", lookbackDays: 7, take: 200 },
    );
  });

  it("rejects a candidates request without a cutover date", async () => {
    const response = await createApp().request("http://localhost/candidates");

    expect(response.status).toBe(400);
    expect(listOrganonIngestionCandidates).not.toHaveBeenCalled();
  });

  it("records sends", async () => {
    vi.mocked(recordOrganonIngestionSends).mockResolvedValue({
      recordedCount: 1,
    });
    const send = {
      canonicalUrl: "https://www.kontan.co.id/news/map-boga",
      tickerSymbols: ["MAPB"],
      organonJobId: "job-1",
      sentAt: "2026-11-17T03:00:00.000Z",
    };

    const response = await postJson(createApp(), "/sends", [send]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recordedCount: 1 });
    expect(recordOrganonIngestionSends).toHaveBeenCalledWith(
      expect.anything(),
      [send],
    );
  });

  it("rejects a send with no tickers", async () => {
    const response = await postJson(createApp(), "/sends", [
      {
        canonicalUrl: "https://www.kontan.co.id/news/map-boga",
        tickerSymbols: [],
        organonJobId: "job-1",
        sentAt: "2026-11-17T03:00:00.000Z",
      },
    ]);

    expect(response.status).toBe(400);
    expect(recordOrganonIngestionSends).not.toHaveBeenCalled();
  });

  it("returns the failed jobs it claimed for a retry", async () => {
    vi.mocked(claimOrganonIngestionRetries).mockResolvedValue({
      claimedJobIds: ["job-1"],
    });

    const response = await postJson(createApp(), "/retries", {
      organonJobIds: ["job-1", "job-2"],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimedJobIds: ["job-1"] });
  });
});

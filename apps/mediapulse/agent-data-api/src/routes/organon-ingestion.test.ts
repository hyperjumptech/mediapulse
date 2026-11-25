/** @vitest-environment node */
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({ prisma: {} }));
vi.mock("../services/organon-ingestion.js", () => ({
  listOrganonIngestionCandidates: vi.fn(),
  listOrganonIngestionSends: vi.fn(),
  recordOrganonIngestionSends: vi.fn(),
  claimOrganonIngestionRetries: vi.fn(),
  markOrganonIngestionEvidenceChecked: vi.fn(),
}));

import {
  claimOrganonIngestionRetries,
  listOrganonIngestionCandidates,
  listOrganonIngestionSends,
  markOrganonIngestionEvidenceChecked,
  recordOrganonIngestionSends,
} from "../services/organon-ingestion.js";
import {
  getOrganonIngestionCandidatesHandler,
  getOrganonIngestionSendsHandler,
  postOrganonIngestionEvidenceChecksHandler,
  postOrganonIngestionRetriesHandler,
  postOrganonIngestionSendsHandler,
} from "./organon-ingestion.js";

const createApp = () => {
  const app = new Hono();
  app.get("/candidates", getOrganonIngestionCandidatesHandler);
  app.get("/sends", getOrganonIngestionSendsHandler);
  app.post("/sends", postOrganonIngestionSendsHandler);
  app.post("/retries", postOrganonIngestionRetriesHandler);
  app.post("/evidence-checks", postOrganonIngestionEvidenceChecksHandler);

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

  it("lists the sends in a window with the default take", async () => {
    vi.mocked(listOrganonIngestionSends).mockResolvedValue({ sends: [] });

    const response = await createApp().request(
      "http://localhost/sends?sentAfter=2026-11-16T03:00:00.000Z&sentBefore=2026-11-17T03:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sends: [] });
    expect(listOrganonIngestionSends).toHaveBeenCalledWith(expect.anything(), {
      sentAfter: "2026-11-16T03:00:00.000Z",
      sentBefore: "2026-11-17T03:00:00.000Z",
      take: 200,
      unchecked: false,
    });
  });

  it("lists only the unchecked sends when asked", async () => {
    vi.mocked(listOrganonIngestionSends).mockResolvedValue({ sends: [] });

    const response = await createApp().request(
      "http://localhost/sends?sentAfter=2026-11-16T03:00:00.000Z&sentBefore=2026-11-17T03:00:00.000Z&unchecked=true",
    );

    expect(response.status).toBe(200);
    expect(listOrganonIngestionSends).toHaveBeenCalledWith(expect.anything(), {
      sentAfter: "2026-11-16T03:00:00.000Z",
      sentBefore: "2026-11-17T03:00:00.000Z",
      take: 200,
      unchecked: true,
    });
  });

  it("rejects a sends request without its window", async () => {
    const response = await createApp().request(
      "http://localhost/sends?sentAfter=2026-11-16T03:00:00.000Z",
    );

    expect(response.status).toBe(400);
    expect(listOrganonIngestionSends).not.toHaveBeenCalled();
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

  it("returns the sends it marked as checked", async () => {
    vi.mocked(markOrganonIngestionEvidenceChecked).mockResolvedValue({
      checkedJobIds: ["job-1"],
    });

    const response = await postJson(createApp(), "/evidence-checks", {
      organonJobIds: ["job-1", "job-2"],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checkedJobIds: ["job-1"] });
    expect(markOrganonIngestionEvidenceChecked).toHaveBeenCalledWith(
      expect.anything(),
      { organonJobIds: ["job-1", "job-2"] },
    );
  });

  it("rejects an evidence check with no jobs", async () => {
    const response = await postJson(createApp(), "/evidence-checks", {
      organonJobIds: [],
    });

    expect(response.status).toBe(400);
    expect(markOrganonIngestionEvidenceChecked).not.toHaveBeenCalled();
  });
});

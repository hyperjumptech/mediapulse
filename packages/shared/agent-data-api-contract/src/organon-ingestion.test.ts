import { describe, expect, it } from "vitest";

import { agentDataApiPathname } from "./agent-data-api-manifest.js";
import {
  getOrganonIngestionCandidatesQuerySchema,
  getOrganonIngestionSendsQuerySchema,
  ORGANON_INGESTION_RETRIES_MAX,
  ORGANON_INGESTION_SENDS_MAX,
  postOrganonIngestionRetriesBodySchema,
  postOrganonIngestionSendsBodySchema,
} from "./organon-ingestion.js";

const send = {
  canonicalUrl: "https://www.kontan.co.id/news/map-boga",
  tickerSymbols: ["MAPB"],
  organonJobId: "job-1",
  sentAt: "2026-11-17T03:00:00.000Z",
};

describe("organon ingestion contract", () => {
  it("serves the candidates, sends and retries under one path", () => {
    expect(agentDataApiPathname("v1", "organonIngestionCandidates")).toBe(
      "/api/v1/organon-ingestion/candidates",
    );
    expect(agentDataApiPathname("v1", "organonIngestionSends")).toBe(
      "/api/v1/organon-ingestion/sends",
    );
    expect(agentDataApiPathname("v2", "organonIngestionRetries")).toBe(
      "/api/v2/organon-ingestion/retries",
    );
  });

  it("reads the sent-articles window and take from query strings", () => {
    expect(
      getOrganonIngestionSendsQuerySchema.parse({
        sentAfter: "2026-11-16T03:00:00.000Z",
        sentBefore: "2026-11-17T03:00:00.000Z",
      }),
    ).toEqual({
      sentAfter: "2026-11-16T03:00:00.000Z",
      sentBefore: "2026-11-17T03:00:00.000Z",
      take: 200,
    });
    expect(
      getOrganonIngestionSendsQuerySchema.safeParse({
        sentAfter: "2026-11-16T03:00:00.000Z",
        sentBefore: "2026-11-17T03:00:00.000Z",
        take: "501",
      }).success,
    ).toBe(false);
  });

  it("reads the lookback and take from query strings, with their defaults", () => {
    expect(
      getOrganonIngestionCandidatesQuerySchema.parse({
        sendFrom: "2026-11-10T00:00:00.000Z",
      }),
    ).toEqual({
      sendFrom: "2026-11-10T00:00:00.000Z",
      lookbackDays: 7,
      take: 200,
    });
    expect(
      getOrganonIngestionCandidatesQuerySchema.parse({
        sendFrom: "2026-11-10T00:00:00.000Z",
        lookbackDays: "3",
        take: "50",
      }),
    ).toMatchObject({ lookbackDays: 3, take: 50 });
  });

  it("requires a cutover date and caps the take", () => {
    expect(getOrganonIngestionCandidatesQuerySchema.safeParse({}).success).toBe(
      false,
    );
    expect(
      getOrganonIngestionCandidatesQuerySchema.safeParse({
        sendFrom: "2026-11-10T00:00:00.000Z",
        take: "501",
      }).success,
    ).toBe(false);
  });

  it("refuses a send with no tickers, and more sends than one call carries", () => {
    expect(
      postOrganonIngestionSendsBodySchema.safeParse([
        { ...send, tickerSymbols: [] },
      ]).success,
    ).toBe(false);
    expect(
      postOrganonIngestionSendsBodySchema.safeParse(
        Array.from({ length: ORGANON_INGESTION_SENDS_MAX + 1 }, () => send),
      ).success,
    ).toBe(false);
    expect(postOrganonIngestionSendsBodySchema.safeParse([send]).success).toBe(
      true,
    );
  });

  it("claims between one and the most retries one call carries", () => {
    expect(
      postOrganonIngestionRetriesBodySchema.safeParse({ organonJobIds: [] })
        .success,
    ).toBe(false);
    expect(
      postOrganonIngestionRetriesBodySchema.safeParse({
        organonJobIds: Array.from(
          { length: ORGANON_INGESTION_RETRIES_MAX + 1 },
          (_, index) => `job-${index}`,
        ),
      }).success,
    ).toBe(false);
  });
});

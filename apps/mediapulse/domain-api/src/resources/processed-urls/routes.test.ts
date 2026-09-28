import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();

  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      collectionUrlOutcome: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { processedUrlsRoutes } from "./routes";

const EXECUTION_ID = "11111111-1111-4111-a111-111111111111";
const SUBJECT_ID = "22222222-2222-4222-a222-222222222222";
const OTHER_SUBJECT_ID = "44444444-4444-4444-a444-444444444444";

const outcomeRow = {
  id: "outcome-1",
  scheduleExecutionId: EXECUTION_ID,
  runId: "run-1",
  tickerId: SUBJECT_ID,
  agent: "data_collection",
  status: "collected",
  url: "https://example.com/article",
  reason: null,
  reasonDetail: null,
  source: null,
  searchQueryId: null,
  curatedSourceId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ticker: { id: SUBJECT_ID, symbol: "ACME" },
  curatedSource: null,
};

const requestList = (query: string) =>
  processedUrlsRoutes.request(`http://localhost/?${query}`, { method: "GET" });

const lastFindManyWhere = () =>
  vi.mocked(prisma.collectionUrlOutcome.findMany).mock.calls[0]?.[0]?.where;

describe("processedUrlsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.collectionUrlOutcome.findMany).mockResolvedValue([
      outcomeRow,
    ] as never);
    vi.mocked(prisma.collectionUrlOutcome.count).mockResolvedValue(1);
  });

  it("serves the subject, the subject title and the legacy ticker symbol", async () => {
    const response = await requestList(`scheduleExecutionId=${EXECUTION_ID}`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      subjectTitle: "Ticker",
      total: 1,
      page: 1,
      items: [
        {
          id: "outcome-1",
          subject: { id: SUBJECT_ID, label: "ACME" },
          tickerSymbol: "ACME",
          agent: "data-collection",
        },
      ],
    });
    expect(lastFindManyWhere()).toEqual({ scheduleExecutionId: EXECUTION_ID });
  });

  it("filters by subjectId", async () => {
    await requestList(`subjectId=${SUBJECT_ID}`);

    expect(lastFindManyWhere()).toEqual({ tickerId: SUBJECT_ID });
    expect(prisma.collectionUrlOutcome.count).toHaveBeenCalledWith({
      where: { tickerId: SUBJECT_ID },
    });
  });

  it("accepts tickerId as an alias for subjectId", async () => {
    await requestList(`tickerId=${SUBJECT_ID}`);

    expect(lastFindManyWhere()).toEqual({ tickerId: SUBJECT_ID });
  });

  it("prefers subjectId over the tickerId alias", async () => {
    await requestList(`subjectId=${SUBJECT_ID}&tickerId=${OTHER_SUBJECT_ID}`);

    expect(lastFindManyWhere()).toEqual({ tickerId: SUBJECT_ID });
  });

  it("ignores a subject id that is not a UUID", async () => {
    await requestList("subjectId=not-a-uuid");

    expect(lastFindManyWhere()).toEqual({});
  });

  it("filters by a known agent id", async () => {
    await requestList("agent=page-collection");

    expect(lastFindManyWhere()).toEqual({ agent: "page_collection" });
  });

  it("returns no rows for an agent that records no processed URLs", async () => {
    await requestList(`scheduleExecutionId=${EXECUTION_ID}&agent=delivery`);

    expect(lastFindManyWhere()).toEqual({
      AND: [{ scheduleExecutionId: EXECUTION_ID }, { id: { in: [] } }],
    });
  });
});

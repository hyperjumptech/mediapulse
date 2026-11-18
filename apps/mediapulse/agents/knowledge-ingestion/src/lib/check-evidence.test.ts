/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type {
  ArticleEvidence,
  IngestionJobStatus,
} from "@mediapulse/knowledge-graph";
import type { OrganonIngestionSentArticle } from "@workspace/agent-data-api-contract";

import { MAX_EVIDENCE_EXAMPLES, checkEvidence } from "./check-evidence.js";

const ARTICLE_URL = "https://www.kontan.co.id/news/map-boga";
const SENT_AFTER = new Date("2026-11-16T03:00:00.000Z");
const SENT_BEFORE = new Date("2026-11-17T03:00:00.000Z");

const sent = (
  overrides: Partial<OrganonIngestionSentArticle> = {},
): OrganonIngestionSentArticle => ({
  canonicalUrl: ARTICLE_URL,
  tickerSymbols: ["MAPB", "MAPI"],
  organonJobId: "job-1",
  sentAt: "2026-11-16T03:05:00.000Z",
  title: "Rugi MAP Boga membengkak",
  description: "MAPB merugi pada sembilan bulan pertama.",
  content: "MAPB merupakan anak usaha PT Mitra Adiperkasa Tbk (MAPI).",
  ...overrides,
});

const point = (overrides: Partial<ArticleEvidence["points"][number]> = {}) => ({
  iri: "https://mediapulse.hyperjump.tech/id/p-1",
  tickerSymbols: ["MAPB", "MAPI"],
  quote: "MAPB merupakan anak usaha PT Mitra Adiperkasa Tbk (MAPI)",
  ...overrides,
});

const setup = ({
  sends,
  status = "completed",
  evidence = { points: [point()], figuresWithoutPoint: [] },
}: {
  sends: OrganonIngestionSentArticle[];
  status?: IngestionJobStatus | null;
  evidence?: ArticleEvidence;
}) => {
  const dataApi = {
    organonIngestionSends: { get: vi.fn().mockResolvedValue({ sends }) },
  };
  const organon = {
    getJobStatus: vi.fn().mockResolvedValue(status),
    articleEvidence: vi.fn().mockResolvedValue(evidence),
  };
  const run = () =>
    checkEvidence({
      organon,
      dataApi: dataApi as unknown as Parameters<
        typeof checkEvidence
      >[0]["dataApi"],
      sentAfter: SENT_AFTER,
      sentBefore: SENT_BEFORE,
      take: 200,
      concurrency: 2,
    });

  return { dataApi, organon, run };
};

describe("checkEvidence", () => {
  it("reads the sends in the window and finds nothing wrong with a clean article", async () => {
    const { dataApi, organon, run } = setup({ sends: [sent()] });

    const result = await run();

    expect(dataApi.organonIngestionSends.get).toHaveBeenCalledWith({
      sentAfter: SENT_AFTER.toISOString(),
      sentBefore: SENT_BEFORE.toISOString(),
      take: 200,
    });
    expect(organon.getJobStatus).toHaveBeenCalledWith("job-1");
    expect(organon.articleEvidence).toHaveBeenCalledWith(ARTICLE_URL);
    expect(result).toMatchObject({
      sends: 1,
      checked: 1,
      withoutPoints: { count: 0 },
      quotesNotInText: { count: 0 },
      figuresWithoutPoint: { count: 0 },
      pointsMissingTicker: { count: 0 },
      errors: { count: 0 },
    });
  });

  it("flags a quote that isn't in the text Mediapulse sent", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: {
        points: [
          point({ quote: "MAPB is a subsidiary of MAPI" }),
          point({
            iri: "https://mediapulse.hyperjump.tech/id/p-2",
            quote: "Rugi MAP Boga membengkak",
          }),
        ],
        figuresWithoutPoint: [],
      },
    });

    const result = await run();

    expect(result.quotesNotInText).toEqual({
      count: 1,
      examples: [
        { canonicalUrl: ARTICLE_URL, quote: "MAPB is a subsidiary of MAPI" },
      ],
    });
  });

  it("flags a point filed under fewer tickers than the article was sent for", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: {
        points: [point({ tickerSymbols: ["MAPB"] })],
        figuresWithoutPoint: [],
      },
    });

    const result = await run();

    expect(result.pointsMissingTicker).toEqual({
      count: 1,
      examples: [
        {
          canonicalUrl: ARTICLE_URL,
          point: "https://mediapulse.hyperjump.tech/id/p-1",
          missingTickerSymbols: ["MAPI"],
        },
      ],
    });
  });

  it("flags figures no point is about, and articles with no points at all", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: {
        points: [],
        figuresWithoutPoint: [
          {
            iri: "https://mediapulse.hyperjump.tech/id/f-1",
            label: "MAPB net loss 9M 2026",
          },
          { iri: "https://mediapulse.hyperjump.tech/id/f-2", label: null },
        ],
      },
    });

    const result = await run();

    expect(result.withoutPoints).toEqual({
      count: 1,
      examples: [{ canonicalUrl: ARTICLE_URL }],
    });
    expect(result.figuresWithoutPoint.examples).toEqual([
      { canonicalUrl: ARTICLE_URL, figure: "MAPB net loss 9M 2026" },
      {
        canonicalUrl: ARTICLE_URL,
        figure: "https://mediapulse.hyperjump.tech/id/f-2",
      },
    ]);
  });

  it("leaves quotes unchecked when Mediapulse no longer has the article's body", async () => {
    const { run } = setup({
      sends: [sent({ content: null })],
      evidence: {
        points: [point({ quote: "anything" })],
        figuresWithoutPoint: [],
      },
    });

    const result = await run();

    expect(result.quotesUnchecked).toBe(1);
    expect(result.quotesNotInText.count).toBe(0);
  });

  it.each([
    ["queued", "unfinished"],
    ["running", "unfinished"],
    ["failed", "failed"],
    ["cancelled", "failed"],
    [null, "jobNotFound"],
  ] as const)("skips an article whose job is %s", async (status, skippedAs) => {
    const { organon, run } = setup({ sends: [sent()], status });

    const result = await run();

    expect(result.checked).toBe(0);
    expect(result.skipped[skippedAs]).toBe(1);
    expect(organon.articleEvidence).not.toHaveBeenCalled();
  });

  it("keeps checking after one article fails, and caps the examples it reports", async () => {
    const sends = Array.from(
      { length: MAX_EVIDENCE_EXAMPLES + 2 },
      (_, index) =>
        sent({
          canonicalUrl: `${ARTICLE_URL}-${index}`,
          organonJobId: `job-${index}`,
        }),
    );
    const { organon, run } = setup({ sends });
    organon.articleEvidence.mockRejectedValueOnce(
      new Error("SPARQL timed out"),
    );
    organon.articleEvidence.mockResolvedValue({
      points: [],
      figuresWithoutPoint: [],
    });

    const result = await run();

    expect(result.errors.count).toBe(1);
    expect(result.errors.examples[0]?.message).toBe("SPARQL timed out");
    expect(result.checked).toBe(sends.length - 1);
    expect(result.withoutPoints.count).toBe(sends.length - 1);
    expect(result.withoutPoints.examples).toHaveLength(MAX_EVIDENCE_EXAMPLES);
  });
});

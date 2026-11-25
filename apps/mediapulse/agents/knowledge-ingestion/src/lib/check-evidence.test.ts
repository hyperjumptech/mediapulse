/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type {
  ArticleEvidence,
  ArticlePoint,
  IngestionJobStatus,
  MarketRelations,
  WrittenLink,
} from "@mediapulse/knowledge-graph";
import type { OrganonIngestionSentArticle } from "@workspace/agent-data-api-contract";

import { MAX_EVIDENCE_EXAMPLES, checkEvidence } from "./check-evidence.js";

const ARTICLE_URL = "https://www.kontan.co.id/news/map-boga";
const SENT_AFTER = new Date("2026-11-16T03:00:00.000Z");
const SENT_BEFORE = new Date("2026-11-17T03:00:00.000Z");
const MP = "https://mediapulse.hyperjump.tech/ontology#";
const ID = "https://mediapulse.hyperjump.tech/id/";
const MAPI = `${ID}mapi`;
const MAPB = `${ID}mapb`;
const STARBUCKS = `${ID}starbucks`;
const SHOPEE = `${ID}shopee`;
const RELATIONS: MarketRelations = new Map([
  [`${MP}partnersWith`, new Set([`${MP}partnersWith`])],
  [`${MP}parentOf`, new Set([`${MP}parentOf`, `${MP}subsidiaryOf`])],
  [`${MP}subsidiaryOf`, new Set([`${MP}subsidiaryOf`, `${MP}parentOf`])],
]);

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

const point = (overrides: Partial<ArticlePoint> = {}): ArticlePoint => ({
  iri: "https://mediapulse.hyperjump.tech/id/p-1",
  tickerSymbols: ["MAPB", "MAPI"],
  quote: "MAPB merupakan anak usaha PT Mitra Adiperkasa Tbk (MAPI)",
  about: [],
  relationObjects: [],
  statesRelation: null,
  ...overrides,
});

const evidenceOf = (
  overrides: Partial<ArticleEvidence> = {},
): ArticleEvidence => ({
  points: [point()],
  figuresWithoutPoint: [],
  figuresInCurrency: [],
  ...overrides,
});

const setup = ({
  sends,
  status = "completed",
  evidence = evidenceOf(),
  writtenLinks = [],
  isPartial = false,
  listedCompanies = new Set(),
}: {
  sends: OrganonIngestionSentArticle[];
  status?: IngestionJobStatus | null;
  evidence?: ArticleEvidence;
  writtenLinks?: WrittenLink[] | null;
  isPartial?: boolean;
  listedCompanies?: ReadonlySet<string>;
}) => {
  const dataApi = {
    organonIngestionSends: { get: vi.fn().mockResolvedValue({ sends }) },
    organonIngestionEvidenceChecks: {
      create: vi
        .fn()
        .mockImplementation(({ organonJobIds }: { organonJobIds: string[] }) =>
          Promise.resolve({ checkedJobIds: organonJobIds }),
        ),
    },
  };
  const organon = {
    getJob: vi
      .fn()
      .mockResolvedValue(
        status === null ? null : { status, writtenLinks, isPartial },
      ),
    articleEvidence: vi.fn().mockResolvedValue(evidence),
    marketRelations: vi.fn().mockResolvedValue(RELATIONS),
    listedCompaniesAmong: vi.fn().mockResolvedValue(listedCompanies),
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
  it("reads the unchecked sends in the window, finds nothing wrong with a clean article, and marks it checked", async () => {
    const { dataApi, organon, run } = setup({ sends: [sent()] });

    const result = await run();

    expect(dataApi.organonIngestionSends.get).toHaveBeenCalledWith({
      sentAfter: SENT_AFTER.toISOString(),
      sentBefore: SENT_BEFORE.toISOString(),
      take: 200,
      unchecked: true,
    });
    expect(dataApi.organonIngestionEvidenceChecks.create).toHaveBeenCalledWith({
      organonJobIds: ["job-1"],
    });
    expect(organon.getJob).toHaveBeenCalledWith("job-1");
    expect(organon.articleEvidence).toHaveBeenCalledWith(ARTICLE_URL);
    expect(result).toMatchObject({
      sends: 1,
      checked: 1,
      marked: 1,
      withoutPoints: { count: 0 },
      quotesNotInText: { count: 0 },
      figuresWithoutPoint: { count: 0 },
      pointsMissingTicker: { count: 0 },
      pointsUnderUnplacedTicker: { count: 0 },
      listedCompanyValuesWithoutPoint: { count: 0 },
      figuresInOtherCurrency: { count: 0 },
      partialJobs: { count: 0 },
      errors: { count: 0 },
    });
    expect(organon.listedCompaniesAmong).not.toHaveBeenCalled();
  });

  it("flags a quote that isn't in the text Mediapulse sent", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: evidenceOf({
        points: [
          point({ quote: "MAPB is a subsidiary of MAPI" }),
          point({
            iri: "https://mediapulse.hyperjump.tech/id/p-2",
            quote: "Rugi MAP Boga membengkak",
          }),
        ],
      }),
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
      evidence: evidenceOf({ points: [point({ tickerSymbols: ["MAPB"] })] }),
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

  it("flags a point filed under a ticker the article wasn't sent for", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: evidenceOf({
        points: [point({ tickerSymbols: ["MAPB", "MAPI", "MAPA"] })],
      }),
    });

    const result = await run();

    expect(result.pointsUnderUnplacedTicker).toEqual({
      count: 1,
      examples: [
        {
          canonicalUrl: ARTICLE_URL,
          point: "https://mediapulse.hyperjump.tech/id/p-1",
          extraTickerSymbols: ["MAPA"],
        },
      ],
    });
    expect(result.pointsMissingTicker.count).toBe(0);
  });

  it("doesn't flag a quote that differs from the text only in its closing punctuation", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: evidenceOf({
        points: [
          point({
            quote: "MAPB merupakan anak usaha PT Mitra Adiperkasa Tbk (MAPI).”",
          }),
        ],
      }),
    });

    const result = await run();

    expect(result.quotesNotInText.count).toBe(0);
  });

  it("flags figures no point is about, and articles with no points at all", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: evidenceOf({
        points: [],
        figuresWithoutPoint: [
          {
            iri: "https://mediapulse.hyperjump.tech/id/f-1",
            label: "MAPB net loss 9M 2026",
          },
          { iri: "https://mediapulse.hyperjump.tech/id/f-2", label: null },
        ],
      }),
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
      evidence: evidenceOf({ points: [point({ quote: "anything" })] }),
    });

    const result = await run();

    expect(result.quotesUnchecked).toBe(1);
    expect(result.quotesNotInText.count).toBe(0);
  });

  it.each([
    ["queued", "unfinished", 0],
    ["running", "unfinished", 0],
    ["ready", "unfinished", 0],
    ["failed", "failed", 1],
    ["cancelled", "failed", 1],
    [null, "jobNotFound", 1],
  ] as const)(
    "skips an article whose job is %s, and marks it checked only once the job can't change",
    async (status, skippedAs, marked) => {
      const { dataApi, organon, run } = setup({ sends: [sent()], status });

      const result = await run();

      expect(result.checked).toBe(0);
      expect(result.skipped[skippedAs]).toBe(1);
      expect(result.marked).toBe(marked);
      expect(organon.articleEvidence).not.toHaveBeenCalled();
      expect(
        dataApi.organonIngestionEvidenceChecks.create,
      ).toHaveBeenCalledTimes(marked);
    },
  );

  it("keeps checking after one article fails, and caps the examples it reports", async () => {
    const sends = Array.from(
      { length: MAX_EVIDENCE_EXAMPLES + 2 },
      (_, index) =>
        sent({
          canonicalUrl: `${ARTICLE_URL}-${index}`,
          organonJobId: `job-${index}`,
        }),
    );
    const { dataApi, organon, run } = setup({ sends });
    organon.articleEvidence.mockRejectedValueOnce(
      new Error("SPARQL timed out"),
    );
    organon.articleEvidence.mockResolvedValue(evidenceOf({ points: [] }));

    const result = await run();

    const markedJobIds =
      dataApi.organonIngestionEvidenceChecks.create.mock.calls[0]?.[0]
        ?.organonJobIds;
    expect(markedJobIds).toHaveLength(sends.length - 1);
    expect(result.marked).toBe(sends.length - 1);
    expect(result.errors.count).toBe(1);
    expect(result.errors.examples[0]?.message).toBe("SPARQL timed out");
    expect(result.checked).toBe(sends.length - 1);
    expect(result.withoutPoints.count).toBe(sends.length - 1);
    expect(result.withoutPoints.examples).toHaveLength(MAX_EVIDENCE_EXAMPLES);
  });
  it("flags a market relation an article added to a listed company with no point stating it", async () => {
    const unsupported = {
      subject: MAPB,
      predicate: `${MP}partnersWith`,
      object: SHOPEE,
    };
    const { organon, run } = setup({
      sends: [sent()],
      writtenLinks: [
        unsupported,
        { subject: MAPI, predicate: `${MP}parentOf`, object: MAPB },
        { subject: STARBUCKS, predicate: `${MP}partnersWith`, object: SHOPEE },
        { subject: `${ID}p-1`, predicate: `${MP}forTicker`, object: MAPI },
      ],
      listedCompanies: new Set([MAPI, MAPB]),
      evidence: evidenceOf({
        points: [
          point({
            about: [MAPB],
            relationObjects: [MAPI],
            statesRelation: `${MP}subsidiaryOf`,
          }),
        ],
      }),
    });

    const result = await run();

    expect(organon.marketRelations).toHaveBeenCalledTimes(1);
    expect(organon.listedCompaniesAmong).toHaveBeenCalledWith([
      MAPB,
      SHOPEE,
      MAPI,
      MAPB,
      STARBUCKS,
      SHOPEE,
    ]);
    expect(result.listedCompanyValuesWithoutPoint).toEqual({
      count: 1,
      examples: [
        {
          canonicalUrl: ARTICLE_URL,
          company: MAPB,
          relation: `${MP}partnersWith`,
          value: SHOPEE,
        },
      ],
    });
  });

  it("flags figures in a currency other than IDR or USD", async () => {
    const { run } = setup({
      sends: [sent()],
      evidence: evidenceOf({
        figuresInCurrency: [
          {
            iri: "https://mediapulse.hyperjump.tech/id/f-1",
            label: "ADES Holding revenue 1H 2026 SAR 2.5 billion",
            currency: "SAR",
          },
          {
            iri: "https://mediapulse.hyperjump.tech/id/f-2",
            label: null,
            currency: "SGD",
          },
        ],
      }),
    });

    const result = await run();

    expect(result.figuresInOtherCurrency).toEqual({
      count: 2,
      examples: [
        {
          canonicalUrl: ARTICLE_URL,
          figure: "ADES Holding revenue 1H 2026 SAR 2.5 billion",
          currency: "SAR",
        },
        {
          canonicalUrl: ARTICLE_URL,
          figure: "https://mediapulse.hyperjump.tech/id/f-2",
          currency: "SGD",
        },
      ],
    });
  });

  it("still checks an article whose job result it can't read, and counts its values as unchecked", async () => {
    const { run } = setup({
      sends: [sent()],
      writtenLinks: null,
      evidence: evidenceOf({ points: [] }),
    });

    const result = await run();

    expect(result.checked).toBe(1);
    expect(result.valuesUnchecked).toBe(1);
    expect(result.withoutPoints.count).toBe(1);
    expect(result.listedCompanyValuesWithoutPoint.count).toBe(0);
  });

  it("counts a job whose answer was cut off and still checks its article", async () => {
    const { run } = setup({
      sends: [sent()],
      isPartial: true,
      evidence: evidenceOf({ points: [] }),
    });

    const result = await run();

    expect(result.partialJobs).toEqual({
      count: 1,
      examples: [{ canonicalUrl: ARTICLE_URL }],
    });
    expect(result.checked).toBe(1);
    expect(result.withoutPoints.count).toBe(1);
  });

  it("reads nothing from the graph when no article was sent in the window", async () => {
    const { organon, run } = setup({ sends: [] });

    const result = await run();

    expect(result.sends).toBe(0);
    expect(organon.marketRelations).not.toHaveBeenCalled();
    expect(organon.getJob).not.toHaveBeenCalled();
  });

  it("marks only what the data API reports as newly checked", async () => {
    const { dataApi, run } = setup({
      sends: [
        sent(),
        sent({ canonicalUrl: `${ARTICLE_URL}-2`, organonJobId: "job-2" }),
      ],
    });
    dataApi.organonIngestionEvidenceChecks.create.mockResolvedValue({
      checkedJobIds: ["job-2"],
    });

    const result = await run();

    expect(result.checked).toBe(2);
    expect(result.marked).toBe(1);
  });
});

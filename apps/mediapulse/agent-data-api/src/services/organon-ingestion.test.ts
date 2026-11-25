/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimOrganonIngestionRetries,
  listOrganonIngestionCandidates,
  listOrganonIngestionSends,
  markOrganonIngestionEvidenceChecked,
  recordOrganonIngestionSends,
  type OrganonIngestionDb,
} from "./organon-ingestion.js";

const NOW = new Date("2026-11-17T03:00:00.000Z");
const SEND_FROM = "2026-11-10T00:00:00.000Z";
const ARTICLE_URL = "https://www.kontan.co.id/news/map-boga-buka-gerai";

const MAPB = {
  id: "ticker-mapb",
  symbol: "MAPB",
  name: "PT Map Boga Adiperkasa Tbk",
};
const MAPI = {
  id: "ticker-mapi",
  symbol: "MAPI",
  name: "PT Mitra Adiperkasa Tbk",
};

const placement = (overrides: {
  dataSourceId: string;
  ticker: typeof MAPB;
  canonicalUrl?: string;
  title?: string;
  content?: string | null;
  sectionScore?: number | null;
  publishedAt?: Date | null;
}) => ({
  sectionScore: overrides.sectionScore ?? 0.5,
  ticker: overrides.ticker,
  dataSource: {
    id: overrides.dataSourceId,
    canonicalUrl: overrides.canonicalUrl ?? ARTICLE_URL,
    url: `${overrides.canonicalUrl ?? ARTICLE_URL}?utm_source=google`,
    title: overrides.title ?? "Map Boga Adiperkasa buka gerai baru",
    description: "MAPB membuka gerai baru.",
    content: overrides.content ?? null,
    publishedAt:
      overrides.publishedAt === undefined
        ? new Date("2026-11-14T01:30:00.000Z")
        : overrides.publishedAt,
    registrableDomain: "kontan.co.id",
  },
});

const placedForSubscribedTicker = {
  section: { not: null },
  ticker: {
    userTickers: { some: { enabled: true, user: { enabled: true } } },
  },
};

const createDb = ({
  recentUrls,
  placements,
  sends = [],
}: {
  recentUrls: string[];
  placements: ReturnType<typeof placement>[];
  sends?: { canonicalUrl: string; tickerSymbols: string[] }[];
}) => {
  const placementFindMany = vi
    .fn()
    .mockResolvedValueOnce(
      recentUrls.map((canonicalUrl) => ({ dataSource: { canonicalUrl } })),
    )
    .mockResolvedValue(placements);
  const sendFindMany = vi.fn().mockResolvedValue(sends);
  const upsert = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn();
  const db = {
    dataSourceTickerSection: { findMany: placementFindMany },
    organonArticleSend: { findMany: sendFindMany, upsert, updateMany },
  } as unknown as OrganonIngestionDb;

  return { db, placementFindMany, sendFindMany, upsert, updateMany };
};

describe("listOrganonIngestionCandidates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads only placements created in the lookback window for articles collected since the cutover", async () => {
    const { db, placementFindMany, sendFindMany } = createDb({
      recentUrls: [],
      placements: [],
    });

    const result = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(result).toEqual({ candidates: [] });
    expect(placementFindMany).toHaveBeenCalledTimes(1);
    expect(placementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...placedForSubscribedTicker,
          createdAt: { gte: new Date("2026-11-10T03:00:00.000Z") },
          dataSource: { createdAt: { gte: new Date(SEND_FROM) } },
        },
      }),
    );
    expect(sendFindMany).not.toHaveBeenCalled();
  });

  it("reads an article's tickers only from placements for tickers someone is subscribed to", async () => {
    const { db, placementFindMany } = createDb({
      recentUrls: [ARTICLE_URL],
      placements: [placement({ dataSourceId: "ds-mapb", ticker: MAPB })],
    });

    await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(placementFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          ...placedForSubscribedTicker,
          dataSource: { canonicalUrl: { in: [ARTICLE_URL] } },
        },
      }),
    );
  });

  it("joins every row of one article into a single candidate naming each placed ticker", async () => {
    const { db } = createDb({
      recentUrls: [ARTICLE_URL, ARTICLE_URL],
      placements: [
        placement({ dataSourceId: "ds-mapb", ticker: MAPB, sectionScore: 0.4 }),
        placement({
          dataSourceId: "ds-curated",
          ticker: MAPI,
          content: "Body as fetched.",
          sectionScore: 0.9,
        }),
        placement({ dataSourceId: "ds-curated", ticker: MAPB }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates).toEqual([
      {
        canonicalUrl: ARTICLE_URL,
        url: `${ARTICLE_URL}?utm_source=google`,
        title: "Map Boga Adiperkasa buka gerai baru",
        description: "MAPB membuka gerai baru.",
        content: "Body as fetched.",
        dataSourceId: "ds-curated",
        dataSourceIds: ["ds-mapb", "ds-curated"],
        publishedAt: "2026-11-14T01:30:00.000Z",
        registrableDomain: "kontan.co.id",
        sectionScore: 0.9,
        tickers: [MAPB, MAPI],
        sentTickerSymbols: [],
      },
    ]);
  });

  it("takes the publish date from another row when the chosen row has none", async () => {
    const { db } = createDb({
      recentUrls: [ARTICLE_URL],
      placements: [
        placement({
          dataSourceId: "ds-body",
          ticker: MAPB,
          content: "Body.",
          publishedAt: null,
        }),
        placement({ dataSourceId: "ds-dated", ticker: MAPI }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates[0]?.publishedAt).toBe("2026-11-14T01:30:00.000Z");
  });

  it("leaves out an article already sent for every ticker it is placed for", async () => {
    const { db } = createDb({
      recentUrls: [ARTICLE_URL],
      placements: [placement({ dataSourceId: "ds-mapb", ticker: MAPB })],
      sends: [{ canonicalUrl: ARTICLE_URL, tickerSymbols: ["MAPB"] }],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates).toEqual([]);
  });

  it("offers an article again once it is placed for a ticker it was not sent for", async () => {
    const { db } = createDb({
      recentUrls: [ARTICLE_URL],
      placements: [
        placement({ dataSourceId: "ds-mapb", ticker: MAPB }),
        placement({ dataSourceId: "ds-mapi", ticker: MAPI }),
      ],
      sends: [{ canonicalUrl: ARTICLE_URL, tickerSymbols: ["MAPB"] }],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates[0]?.tickers.map((ticker) => ticker.symbol)).toEqual([
      "MAPB",
      "MAPI",
    ]);
    expect(candidates[0]?.sentTickerSymbols).toEqual(["MAPB"]);
  });

  it("leaves out a stock-market story placed before article analysis rejected them", async () => {
    const stockUrl = "https://bataviapos.id/saham-tambang-tertekan";
    const { db } = createDb({
      recentUrls: [stockUrl, ARTICLE_URL],
      placements: [
        placement({
          dataSourceId: "ds-stock",
          ticker: MAPB,
          canonicalUrl: stockUrl,
          title:
            "Saham Tambang Tertekan Usai Instruksi Prabowo soal Keuntungan 70% untuk Negara",
          content: "Isi artikel saham.",
        }),
        placement({ dataSourceId: "ds-news", ticker: MAPB, content: "Isi." }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates.map((candidate) => candidate.canonicalUrl)).toEqual([
      ARTICLE_URL,
    ]);
  });

  it("treats a stored Cloudflare error page as a missing body, so the agent fetches the article", async () => {
    const errorPage =
      "Web server is returning an unknown error Error code 520 Visit cloudflare.com for more information. There is an unknown connection issue between Cloudflare and the origin web server.";
    const { db } = createDb({
      recentUrls: [ARTICLE_URL],
      placements: [
        placement({
          dataSourceId: "ds-error",
          ticker: MAPB,
          content: errorPage,
        }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates[0]).toMatchObject({
      dataSourceId: "ds-error",
      content: null,
    });
  });

  it("prefers a row with a real body over one holding an error page", async () => {
    const errorPage =
      "Invalid SSL certificate Error code 526 Visit cloudflare.com for more information. Cloudflare cannot validate the SSL certificate on the origin web server.";
    const { db } = createDb({
      recentUrls: [ARTICLE_URL, ARTICLE_URL],
      placements: [
        placement({
          dataSourceId: "ds-error",
          ticker: MAPB,
          content: errorPage,
        }),
        placement({
          dataSourceId: "ds-body",
          ticker: MAPI,
          content: "Body as fetched.",
        }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 200 },
      NOW,
    );

    expect(candidates[0]).toMatchObject({
      dataSourceId: "ds-body",
      content: "Body as fetched.",
    });
  });

  it("returns at most take candidates, oldest placement first", async () => {
    const otherUrl = "https://www.bisnis.com/read/mapi-laba";
    const { db } = createDb({
      recentUrls: [ARTICLE_URL, otherUrl],
      placements: [
        placement({ dataSourceId: "ds-1", ticker: MAPB }),
        placement({
          dataSourceId: "ds-2",
          ticker: MAPI,
          canonicalUrl: otherUrl,
        }),
      ],
    });

    const { candidates } = await listOrganonIngestionCandidates(
      db,
      { sendFrom: SEND_FROM, lookbackDays: 7, take: 1 },
      NOW,
    );

    expect(candidates.map((candidate) => candidate.canonicalUrl)).toEqual([
      ARTICLE_URL,
    ]);
  });
});

describe("listOrganonIngestionSends", () => {
  const window = {
    sentAfter: "2026-11-16T03:00:00.000Z",
    sentBefore: "2026-11-17T03:00:00.000Z",
    take: 200,
    unchecked: false,
  };

  const createSendsDb = ({
    sends,
    placements,
  }: {
    sends: {
      canonicalUrl: string;
      tickerSymbols: string[];
      organonJobId: string;
      sentAt: Date;
    }[];
    placements: ReturnType<typeof placement>[];
  }) => {
    const sendFindMany = vi.fn().mockResolvedValue(sends);
    const placementFindMany = vi.fn().mockResolvedValue(placements);
    const db = {
      dataSourceTickerSection: { findMany: placementFindMany },
      organonArticleSend: { findMany: sendFindMany },
    } as unknown as OrganonIngestionDb;

    return { db, sendFindMany, placementFindMany };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the sends in the window, oldest first, with the article text that was sent", async () => {
    const { db, sendFindMany, placementFindMany } = createSendsDb({
      sends: [
        {
          canonicalUrl: ARTICLE_URL,
          tickerSymbols: ["MAPB", "MAPI"],
          organonJobId: "job-1",
          sentAt: new Date("2026-11-16T03:05:00.000Z"),
        },
      ],
      placements: [
        placement({ dataSourceId: "ds-mapb", ticker: MAPB }),
        placement({
          dataSourceId: "ds-mapi",
          ticker: MAPI,
          content: "Isi artikel lengkap.",
        }),
      ],
    });

    const result = await listOrganonIngestionSends(db, window);

    expect(result).toEqual({
      sends: [
        {
          canonicalUrl: ARTICLE_URL,
          tickerSymbols: ["MAPB", "MAPI"],
          organonJobId: "job-1",
          sentAt: "2026-11-16T03:05:00.000Z",
          title: "Map Boga Adiperkasa buka gerai baru",
          description: "MAPB membuka gerai baru.",
          content: "Isi artikel lengkap.",
        },
      ],
    });
    expect(sendFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sentAt: {
            gte: new Date(window.sentAfter),
            lt: new Date(window.sentBefore),
          },
        },
        orderBy: { sentAt: "asc" },
        take: 200,
      }),
    );
    expect(placementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...placedForSubscribedTicker,
          dataSource: { canonicalUrl: { in: [ARTICLE_URL] } },
        },
      }),
    );
  });

  it("reads only the unchecked sends whose send or retry falls in the window", async () => {
    const { db, sendFindMany } = createSendsDb({ sends: [], placements: [] });

    await listOrganonIngestionSends(db, { ...window, unchecked: true });

    const inWindow = {
      gte: new Date(window.sentAfter),
      lt: new Date(window.sentBefore),
    };
    expect(sendFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          evidenceCheckedAt: null,
          OR: [{ sentAt: inWindow }, { failureRetriedAt: inWindow }],
        },
        orderBy: { sentAt: "asc" },
        take: 200,
      }),
    );
  });

  it("returns a send with no text when its article is no longer placed", async () => {
    const { db } = createSendsDb({
      sends: [
        {
          canonicalUrl: ARTICLE_URL,
          tickerSymbols: ["MAPB"],
          organonJobId: "job-1",
          sentAt: new Date("2026-11-16T03:05:00.000Z"),
        },
      ],
      placements: [],
    });

    const result = await listOrganonIngestionSends(db, window);

    expect(result.sends[0]).toMatchObject({
      title: null,
      description: null,
      content: null,
    });
  });

  it("skips the article lookup when nothing was sent in the window", async () => {
    const { db, placementFindMany } = createSendsDb({
      sends: [],
      placements: [],
    });

    await expect(listOrganonIngestionSends(db, window)).resolves.toEqual({
      sends: [],
    });
    expect(placementFindMany).not.toHaveBeenCalled();
  });
});

describe("recordOrganonIngestionSends", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the tickers and job of each send, and clears an earlier retry and check", async () => {
    const { db, upsert } = createDb({ recentUrls: [], placements: [] });

    const result = await recordOrganonIngestionSends(db, [
      {
        canonicalUrl: ARTICLE_URL,
        tickerSymbols: ["MAPB", "MAPI"],
        organonJobId: "job-1",
        sentAt: "2026-11-17T03:00:00.000Z",
      },
    ]);

    expect(result).toEqual({ recordedCount: 1 });
    expect(upsert).toHaveBeenCalledWith({
      where: { canonicalUrl: ARTICLE_URL },
      create: {
        canonicalUrl: ARTICLE_URL,
        tickerSymbols: ["MAPB", "MAPI"],
        organonJobId: "job-1",
        sentAt: NOW,
      },
      update: {
        tickerSymbols: ["MAPB", "MAPI"],
        organonJobId: "job-1",
        sentAt: NOW,
        failureRetriedAt: null,
        evidenceCheckedAt: null,
      },
    });
  });
});

describe("claimOrganonIngestionRetries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims each failed job once, only while its send was never retried", async () => {
    const { db, updateMany } = createDb({ recentUrls: [], placements: [] });
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await claimOrganonIngestionRetries(
      db,
      { organonJobIds: ["job-1", "job-2", "job-1"] },
      NOW,
    );

    expect(result).toEqual({ claimedJobIds: ["job-1"] });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { organonJobId: "job-1", failureRetriedAt: null },
      data: { failureRetriedAt: NOW },
    });
  });
});

describe("markOrganonIngestionEvidenceChecked", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks each job's send once, only while it was never checked", async () => {
    const { db, updateMany } = createDb({ recentUrls: [], placements: [] });
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await markOrganonIngestionEvidenceChecked(
      db,
      { organonJobIds: ["job-1", "job-2", "job-1"] },
      NOW,
    );

    expect(result).toEqual({ checkedJobIds: ["job-1"] });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { organonJobId: "job-1", evidenceCheckedAt: null },
      data: { evidenceCheckedAt: NOW },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { organonJobId: "job-2", evidenceCheckedAt: null },
      data: { evidenceCheckedAt: NOW },
    });
  });
});

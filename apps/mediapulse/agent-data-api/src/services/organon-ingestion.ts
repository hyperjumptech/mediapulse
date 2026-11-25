import type { Prisma, PrismaClient } from "@mediapulse/database";
import type {
  GetOrganonIngestionCandidatesQuery,
  GetOrganonIngestionCandidatesResponse,
  GetOrganonIngestionSendsQuery,
  GetOrganonIngestionSendsResponse,
  OrganonIngestionCandidate,
  OrganonIngestionTicker,
  PostOrganonIngestionEvidenceChecksBody,
  PostOrganonIngestionEvidenceChecksResponse,
  PostOrganonIngestionRetriesBody,
  PostOrganonIngestionRetriesResponse,
  PostOrganonIngestionSendsBody,
  PostOrganonIngestionSendsResponse,
} from "@workspace/agent-data-api-contract";
import {
  isOriginErrorPage,
  isStockMarketTitle,
} from "@workspace/agent-ingestion";

export type OrganonIngestionDb = Pick<
  PrismaClient,
  "dataSourceTickerSection" | "organonArticleSend"
>;

const DAY_MS = 86_400_000;
export const CANONICAL_URL_BATCH_SIZE = 1_000;

const placedForSubscribedTicker = {
  section: { not: null },
  ticker: {
    userTickers: { some: { enabled: true, user: { enabled: true } } },
  },
} satisfies Prisma.DataSourceTickerSectionWhereInput;

const placementSelect = {
  sectionScore: true,
  ticker: { select: { id: true, symbol: true, name: true } },
  dataSource: {
    select: {
      id: true,
      canonicalUrl: true,
      url: true,
      title: true,
      description: true,
      content: true,
      publishedAt: true,
      registrableDomain: true,
    },
  },
} satisfies Prisma.DataSourceTickerSectionSelect;

type Placement = Prisma.DataSourceTickerSectionGetPayload<{
  select: typeof placementSelect;
}>;

const sentArticleSelect = {
  dataSource: {
    select: {
      canonicalUrl: true,
      title: true,
      description: true,
      content: true,
    },
  },
} satisfies Prisma.DataSourceTickerSectionSelect;

type SentArticleSource = Prisma.DataSourceTickerSectionGetPayload<{
  select: typeof sentArticleSelect;
}>["dataSource"];

const uniqueInOrder = <Value>(values: readonly Value[]): Value[] => [
  ...new Set(values),
];

const firstPresent = <Value>(values: readonly (Value | null)[]): Value | null =>
  values.find((value) => value !== null) ?? null;

const highestScore = (placements: readonly Placement[]): number | null => {
  const scores = placements.flatMap((placement) =>
    placement.sectionScore === null ? [] : [placement.sectionScore],
  );

  return scores.length === 0 ? null : Math.max(...scores);
};

const placedTickers = (
  placements: readonly Placement[],
): OrganonIngestionTicker[] => {
  const bySymbol = new Map<string, OrganonIngestionTicker>();
  for (const { ticker } of placements) {
    if (!bySymbol.has(ticker.symbol)) {
      bySymbol.set(ticker.symbol, ticker);
    }
  }

  return [...bySymbol.values()];
};

const usableBody = (content: string | null): string | null =>
  content === null || isOriginErrorPage(content) ? null : content;

const toCandidate = (
  canonicalUrl: string,
  placements: readonly Placement[],
  sentTickerSymbols: readonly string[],
): OrganonIngestionCandidate | undefined => {
  const tickers = placedTickers(placements);
  const sent = new Set(sentTickerSymbols);
  if (tickers.every((ticker) => sent.has(ticker.symbol))) {
    return undefined;
  }

  const sources = placements.map((placement) => placement.dataSource);
  if (sources.some((source) => isStockMarketTitle(source.title))) {
    return undefined;
  }
  const article =
    sources.find((source) => usableBody(source.content) !== null) ?? sources[0];
  if (!article) {
    return undefined;
  }
  const publishedAt =
    article.publishedAt ??
    firstPresent(sources.map((source) => source.publishedAt));

  return {
    canonicalUrl,
    url: article.url,
    title: article.title,
    description:
      article.description ??
      firstPresent(sources.map((source) => source.description)),
    content: usableBody(article.content),
    dataSourceId: article.id,
    dataSourceIds: uniqueInOrder(sources.map((source) => source.id)),
    publishedAt: publishedAt?.toISOString() ?? null,
    registrableDomain:
      article.registrableDomain ??
      firstPresent(sources.map((source) => source.registrableDomain)),
    sectionScore: highestScore(placements),
    tickers,
    sentTickerSymbols: [...sentTickerSymbols],
  };
};

const candidatesForBatch = async (
  db: OrganonIngestionDb,
  canonicalUrls: readonly string[],
): Promise<OrganonIngestionCandidate[]> => {
  const [placements, sends] = await Promise.all([
    db.dataSourceTickerSection.findMany({
      where: {
        ...placedForSubscribedTicker,
        dataSource: { canonicalUrl: { in: [...canonicalUrls] } },
      },
      select: placementSelect,
      orderBy: { createdAt: "asc" },
    }),
    db.organonArticleSend.findMany({
      where: { canonicalUrl: { in: [...canonicalUrls] } },
      select: { canonicalUrl: true, tickerSymbols: true },
    }),
  ]);

  const placementsByUrl = new Map<string, Placement[]>();
  for (const placement of placements) {
    const url = placement.dataSource.canonicalUrl;
    placementsByUrl.set(url, [...(placementsByUrl.get(url) ?? []), placement]);
  }
  const sentByUrl = new Map(
    sends.map((send) => [send.canonicalUrl, send.tickerSymbols]),
  );

  return canonicalUrls.flatMap((canonicalUrl) => {
    const candidate = toCandidate(
      canonicalUrl,
      placementsByUrl.get(canonicalUrl) ?? [],
      sentByUrl.get(canonicalUrl) ?? [],
    );

    return candidate ? [candidate] : [];
  });
};

export const listOrganonIngestionCandidates = async (
  db: OrganonIngestionDb,
  query: GetOrganonIngestionCandidatesQuery,
  now: Date = new Date(),
): Promise<GetOrganonIngestionCandidatesResponse> => {
  const recentPlacements = await db.dataSourceTickerSection.findMany({
    where: {
      ...placedForSubscribedTicker,
      createdAt: { gte: new Date(now.getTime() - query.lookbackDays * DAY_MS) },
      dataSource: { createdAt: { gte: new Date(query.sendFrom) } },
    },
    select: { dataSource: { select: { canonicalUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  const canonicalUrls = uniqueInOrder(
    recentPlacements.map((placement) => placement.dataSource.canonicalUrl),
  );

  const candidates: OrganonIngestionCandidate[] = [];
  for (
    let start = 0;
    start < canonicalUrls.length && candidates.length < query.take;
    start += CANONICAL_URL_BATCH_SIZE
  ) {
    const batch = canonicalUrls.slice(start, start + CANONICAL_URL_BATCH_SIZE);
    candidates.push(...(await candidatesForBatch(db, batch)));
  }

  return { candidates: candidates.slice(0, query.take) };
};

export const recordOrganonIngestionSends = async (
  db: OrganonIngestionDb,
  sends: PostOrganonIngestionSendsBody,
): Promise<PostOrganonIngestionSendsResponse> => {
  for (const send of sends) {
    const values = {
      tickerSymbols: send.tickerSymbols,
      organonJobId: send.organonJobId,
      sentAt: new Date(send.sentAt),
    };
    await db.organonArticleSend.upsert({
      where: { canonicalUrl: send.canonicalUrl },
      create: { canonicalUrl: send.canonicalUrl, ...values },
      update: { ...values, failureRetriedAt: null, evidenceCheckedAt: null },
    });
  }

  return { recordedCount: sends.length };
};

const groupByCanonicalUrl = <Row extends { canonicalUrl: string }>(
  rows: readonly Row[],
): Map<string, Row[]> => {
  const byUrl = new Map<string, Row[]>();
  for (const row of rows) {
    byUrl.set(row.canonicalUrl, [...(byUrl.get(row.canonicalUrl) ?? []), row]);
  }

  return byUrl;
};

const sentArticleText = (sources: readonly SentArticleSource[]) => {
  const article =
    sources.find((source) => source.content !== null) ?? sources[0];

  return {
    title: article?.title ?? null,
    description:
      article?.description ??
      firstPresent(sources.map((source) => source.description)),
    content: article?.content ?? null,
  };
};

export const listOrganonIngestionSends = async (
  db: OrganonIngestionDb,
  query: GetOrganonIngestionSendsQuery,
): Promise<GetOrganonIngestionSendsResponse> => {
  const inWindow = {
    gte: new Date(query.sentAfter),
    lt: new Date(query.sentBefore),
  };
  const sends = await db.organonArticleSend.findMany({
    where: query.unchecked
      ? {
          evidenceCheckedAt: null,
          OR: [{ sentAt: inWindow }, { failureRetriedAt: inWindow }],
        }
      : { sentAt: inWindow },
    select: {
      canonicalUrl: true,
      tickerSymbols: true,
      organonJobId: true,
      sentAt: true,
    },
    orderBy: { sentAt: "asc" },
    take: query.take,
  });
  if (sends.length === 0) {
    return { sends: [] };
  }

  const placements = await db.dataSourceTickerSection.findMany({
    where: {
      ...placedForSubscribedTicker,
      dataSource: {
        canonicalUrl: {
          in: uniqueInOrder(sends.map((send) => send.canonicalUrl)),
        },
      },
    },
    select: sentArticleSelect,
    orderBy: { createdAt: "asc" },
  });
  const sourcesByUrl = groupByCanonicalUrl(
    placements.map((placement) => placement.dataSource),
  );

  return {
    sends: sends.map((send) => ({
      canonicalUrl: send.canonicalUrl,
      tickerSymbols: send.tickerSymbols,
      organonJobId: send.organonJobId,
      sentAt: send.sentAt.toISOString(),
      ...sentArticleText(sourcesByUrl.get(send.canonicalUrl) ?? []),
    })),
  };
};

export const claimOrganonIngestionRetries = async (
  db: OrganonIngestionDb,
  { organonJobIds }: PostOrganonIngestionRetriesBody,
  now: Date = new Date(),
): Promise<PostOrganonIngestionRetriesResponse> => {
  const claimedJobIds: string[] = [];
  for (const organonJobId of uniqueInOrder(organonJobIds)) {
    const result = await db.organonArticleSend.updateMany({
      where: { organonJobId, failureRetriedAt: null },
      data: { failureRetriedAt: now },
    });
    if (result.count > 0) {
      claimedJobIds.push(organonJobId);
    }
  }

  return { claimedJobIds };
};

export const markOrganonIngestionEvidenceChecked = async (
  db: OrganonIngestionDb,
  { organonJobIds }: PostOrganonIngestionEvidenceChecksBody,
  now: Date = new Date(),
): Promise<PostOrganonIngestionEvidenceChecksResponse> => {
  const checkedJobIds: string[] = [];
  for (const organonJobId of uniqueInOrder(organonJobIds)) {
    const result = await db.organonArticleSend.updateMany({
      where: { organonJobId, evidenceCheckedAt: null },
      data: { evidenceCheckedAt: now },
    });
    if (result.count > 0) {
      checkedJobIds.push(organonJobId);
    }
  }

  return { checkedJobIds };
};

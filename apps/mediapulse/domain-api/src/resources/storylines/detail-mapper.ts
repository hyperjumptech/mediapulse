import type { Prisma } from "@mediapulse/database";

import {
  buildStorylineHeader,
  type StorylineHeaderPayload,
} from "./build-storyline-header";
import {
  buildStorylineGraph,
  type StorylineGraphPayload,
} from "./build-storyline-graph";
import {
  evidenceLabel,
  evidenceVariant,
  kindLabel,
  lockedLabel,
  parseAttachEvidence,
  tickerSourceLabel,
  type StorylineEvidenceVariant,
} from "./storyline-labels";

export const STORYLINE_DEVELOPMENT_FETCH_CAP = 200;
export const STORYLINE_CITATION_FETCH_CAP = 500;

export const detailInclude = {
  anchors: { select: { anchor: true }, orderBy: { anchor: "asc" } },
  tickers: {
    select: {
      tickerId: true,
      source: true,
      createdAt: true,
      ticker: { select: { symbol: true, name: true } },
    },
    orderBy: { ticker: { symbol: "asc" } },
  },
  developments: {
    orderBy: { observedAt: "asc" },
    take: STORYLINE_DEVELOPMENT_FETCH_CAP,
    select: {
      id: true,
      title: true,
      observedAt: true,
      attachEvidence: true,
      ingestionRunId: true,
      _count: { select: { citations: true } },
    },
  },
} satisfies Prisma.StorylineInclude;

export type StorylineDetailRow = Prisma.StorylineGetPayload<{
  include: typeof detailInclude;
}>;

export type StorylineCitationRowInput = Prisma.DevelopmentCitationGetPayload<{
  select: {
    id: true;
    createdAt: true;
    developmentId: true;
    dataSourceId: true;
    dataSource: {
      select: {
        id: true;
        title: true;
        url: true;
        registrableDomain: true;
        publishedAt: true;
      };
    };
  };
}>;

export type StorylineDevelopmentRow = {
  id: string;
  title: string;
  observedAt: string;
  citationCount: number;
  isOpener: boolean;
  evidenceLabel: string;
  evidenceVariant: StorylineEvidenceVariant;
  ingestionRunId: string | null;
};

export type StorylineCitationRow = {
  id: string;
  dataSourceId: string;
  title: string;
  url: string;
  publisher: string;
  developmentTitle: string;
  createdAt: string;
};

export type StorylineTickerRow = {
  tickerId: string;
  symbol: string;
  name: string;
  sourceLabel: string;
  createdAt: string;
};

export type DetailItem = {
  id: string;
  title: string;
  name: string;
  kind: string;
  kindLabel: string;
  locked: boolean;
  lockedLabel: string;
  lockedReason: string | null;
  lockedAt: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;
  developmentCount: number;
  citationCount: number;
  tickerCount: number;
  anchorCount: number;
  header: StorylineHeaderPayload;
  developments: StorylineDevelopmentRow[];
  citations: StorylineCitationRow[];
  tickers: StorylineTickerRow[];
  anchors: { anchor: string }[];
  graph: StorylineGraphPayload;
};

export function mapRowToDetailItem(
  row: StorylineDetailRow,
  citationRows: readonly StorylineCitationRowInput[],
): DetailItem {
  const titleByDevelopmentId = new Map(
    row.developments.map((development) => [development.id, development.title]),
  );
  const citationCount = row.developments.reduce(
    (sum, development) => sum + development._count.citations,
    0,
  );
  const tickerSymbols = row.tickers.map((link) => link.ticker.symbol);

  const developments: StorylineDevelopmentRow[] = row.developments.map(
    (development) => ({
      id: development.id,
      title: development.title,
      observedAt: development.observedAt.toISOString(),
      citationCount: development._count.citations,
      isOpener: parseAttachEvidence(development.attachEvidence) === null,
      evidenceLabel: evidenceLabel(development.attachEvidence),
      evidenceVariant: evidenceVariant(development.attachEvidence),
      ingestionRunId: development.ingestionRunId,
    }),
  );

  const citations: StorylineCitationRow[] = citationRows.map((citation) => ({
    id: citation.id,
    dataSourceId: citation.dataSourceId,
    title: citation.dataSource.title ?? citation.dataSource.url,
    url: citation.dataSource.url,
    publisher: citation.dataSource.registrableDomain ?? "—",
    developmentTitle: titleByDevelopmentId.get(citation.developmentId) ?? "—",
    createdAt: citation.createdAt.toISOString(),
  }));

  const tickers: StorylineTickerRow[] = row.tickers.map((link) => ({
    tickerId: link.tickerId,
    symbol: link.ticker.symbol,
    name: link.ticker.name,
    sourceLabel: tickerSourceLabel(link.source),
    createdAt: link.createdAt.toISOString(),
  }));

  const graph = buildStorylineGraph({
    storyline: {
      id: row.id,
      name: row.name,
      kind: row.kind,
      firstObservedAt: row.firstObservedAt,
      lastObservedAt: row.lastObservedAt,
    },
    tickers: row.tickers.map((link) => ({
      tickerId: link.tickerId,
      symbol: link.ticker.symbol,
      name: link.ticker.name,
      source: link.source,
    })),
    developments: row.developments.map((development) => ({
      id: development.id,
      title: development.title,
      observedAt: development.observedAt,
      attachEvidence: development.attachEvidence,
      citationCount: development._count.citations,
    })),
    citations: citationRows.map((citation) => ({
      developmentId: citation.developmentId,
      dataSourceId: citation.dataSourceId,
      title: citation.dataSource.title,
      url: citation.dataSource.url,
      publisher: citation.dataSource.registrableDomain,
    })),
  });

  return {
    id: row.id,
    title: row.name,
    name: row.name,
    kind: row.kind,
    kindLabel: kindLabel(row.kind),
    locked: row.locked,
    lockedLabel: lockedLabel(row.locked),
    lockedReason: row.lockedReason,
    lockedAt: row.lockedAt ? row.lockedAt.toISOString() : null,
    firstObservedAt: row.firstObservedAt.toISOString(),
    lastObservedAt: row.lastObservedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    developmentCount: row.developments.length,
    citationCount,
    tickerCount: row.tickers.length,
    anchorCount: row.anchors.length,
    header: buildStorylineHeader({
      kind: row.kind,
      locked: row.locked,
      firstObservedAt: row.firstObservedAt,
      lastObservedAt: row.lastObservedAt,
      developmentCount: row.developments.length,
      citationCount,
      tickerSymbols,
    }),
    developments,
    citations,
    tickers,
    anchors: row.anchors.map((anchor) => ({ anchor: anchor.anchor })),
    graph,
  };
}

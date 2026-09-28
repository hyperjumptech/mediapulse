import type { Prisma } from "@mediapulse/database";

export const PROCESSED_URL_SUBJECT_TITLE = "Ticker";

export const listInclude = {
  ticker: {
    select: { id: true, symbol: true },
  },
  curatedSource: {
    select: { id: true, name: true, listingUrl: true },
  },
} satisfies Prisma.CollectionUrlOutcomeInclude;

export type ListRow = Prisma.CollectionUrlOutcomeGetPayload<{
  include: typeof listInclude;
}>;

export type ProcessedUrlSubject = {
  id: string;
  label: string;
};

const toSubject = (ticker: ListRow["ticker"]): ProcessedUrlSubject | null => {
  if (!ticker) {
    return null;
  }

  return { id: ticker.id, label: ticker.symbol };
};

export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  subject: toSubject(row.ticker),
  tickerSymbol: row.ticker?.symbol ?? "—",
  agent:
    row.agent === "data_collection" ? "data-collection" : "page-collection",
  url: row.url,
  status: row.status,
  gateStatus: row.status === "collected" ? "passed" : "failed",
  reason: row.reason ?? null,
  reasonDetail: row.reasonDetail ?? null,
  source: row.source ?? null,
  curatedSourceId: row.curatedSourceId,
  curatedSourceName: row.curatedSource?.name ?? null,
  curatedSourceListingUrl: row.curatedSource?.listingUrl ?? null,
  createdAt: row.createdAt.toISOString(),
});

export type ListItem = ReturnType<typeof mapRowToListItem>;

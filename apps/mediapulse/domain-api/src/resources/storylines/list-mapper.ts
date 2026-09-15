import type { Prisma } from "@mediapulse/database";

import { kindLabel, lockedLabel } from "./storyline-labels";

export const STORYLINE_LIST_TICKER_CHIPS = 6;

export const listInclude = {
  _count: { select: { developments: true, tickers: true } },
  tickers: {
    select: { ticker: { select: { symbol: true } } },
    orderBy: { ticker: { symbol: "asc" } },
    take: STORYLINE_LIST_TICKER_CHIPS,
  },
} satisfies Prisma.StorylineInclude;

export type StorylineListRow = Prisma.StorylineGetPayload<{
  include: typeof listInclude;
}>;

export type ListItem = {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  lockedLabel: string;
  developmentCount: number;
  citationCount: number;
  tickerCount: number;
  tickerSymbols: string;
  firstObservedAt: string;
  lastObservedAt: string;
};

export function mapRowToListItem(
  row: StorylineListRow,
  citationCount: number,
): ListItem {
  const symbols = row.tickers.map((link) => link.ticker.symbol);
  const overflow = row._count.tickers - symbols.length;
  const tickerSymbols =
    symbols.length === 0
      ? "—"
      : overflow > 0
        ? `${symbols.join(", ")} +${String(overflow)}`
        : symbols.join(", ");

  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    kindLabel: kindLabel(row.kind),
    lockedLabel: lockedLabel(row.locked),
    developmentCount: row._count.developments,
    citationCount,
    tickerCount: row._count.tickers,
    tickerSymbols,
    firstObservedAt: row.firstObservedAt.toISOString(),
    lastObservedAt: row.lastObservedAt.toISOString(),
  };
}

import type {
  Day1DispatchKind,
  Day1DispatchStatus,
  Prisma,
} from "@mediapulse/database";

export const day1DispatchInclude = {
  ticker: { select: { symbol: true } },
  userTicker: { select: { userId: true, user: { select: { email: true } } } },
} satisfies Prisma.Day1NewsletterDispatchInclude;

export type Day1DispatchRow = Prisma.Day1NewsletterDispatchGetPayload<{
  include: typeof day1DispatchInclude;
}>;

export const DAY1_DISPATCH_KIND_LABELS = {
  bootstrap: "Full chain",
  latest_issue: "Latest issue",
  none: "None",
} as const satisfies Record<Day1DispatchKind, string>;

export const DAY1_DISPATCH_STATUS_LABELS = {
  dispatching: "Dispatching",
  fired: "Fired",
  failed: "Failed",
  skipped: "Skipped",
} as const satisfies Record<Day1DispatchStatus, string>;

const DAY1_SKIP_REASON_LABELS: Record<string, string> = {
  already_dispatched: "Already dispatched for this subscription",
  not_configured: "No Hermes trigger listens for this day-1 event yet",
  missing_translation: "Latest issue has no translation for this language",
  nightly_owns_ticker:
    "Stale issue and other subscribers, nightly run covers it",
  bootstrap_in_flight: "A full-chain run for this ticker is already running",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  id: "Indonesian",
};

export const formatDay1SkipReason = (reason: string | null): string | null =>
  reason === null ? null : (DAY1_SKIP_REASON_LABELS[reason] ?? reason);

export type ListItem = {
  id: string;
  createdAt: string;
  tickerSymbol: string;
  subscriberEmail: string;
  kind: string;
  status: string;
  reason: string | null;
  language: string;
};

export const mapRowToListItem = (row: Day1DispatchRow): ListItem => ({
  id: row.id,
  createdAt: row.createdAt.toISOString(),
  tickerSymbol: row.ticker.symbol,
  subscriberEmail: row.userTicker.user.email,
  kind: DAY1_DISPATCH_KIND_LABELS[row.kind],
  status: DAY1_DISPATCH_STATUS_LABELS[row.status],
  reason: formatDay1SkipReason(row.reason),
  language: LANGUAGE_LABELS[row.language] ?? row.language,
});

export type DetailItem = ListItem & {
  title: string;
  userId: string;
  tickerId: string;
  hermesExecutionId: string | null;
  error: string | null;
  updatedAt: string;
};

export const mapRowToDetailItem = (row: Day1DispatchRow): DetailItem => {
  const listItem = mapRowToListItem(row);

  return {
    ...listItem,
    title: `${listItem.tickerSymbol} · ${listItem.subscriberEmail}`,
    userId: row.userTicker.userId,
    tickerId: row.tickerId,
    hermesExecutionId: row.hermesExecutionId,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
  };
};

import {
  formatRelativeTime,
  formatUtcTimestamp,
} from "@/lib/format-relative-time";

export const RelativeTime = ({ date, now }: { date: Date; now: Date }) => {
  const relativeLabel = formatRelativeTime(date, now);
  const absoluteLabel = formatUtcTimestamp(date);

  return (
    <time
      dateTime={date.toISOString()}
      title={absoluteLabel}
      className="shrink-0 text-xs text-muted-foreground tabular-nums"
    >
      {relativeLabel}
    </time>
  );
};

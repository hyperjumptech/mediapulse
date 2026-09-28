"use client";

import { useNow } from "@/hooks/use-now";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@workspace/ui/lib/utils";

const localTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const RelativeTime = ({
  value,
  className,
}: {
  value: Date | string;
  className?: string;
}) => {
  const now = useNow();
  const date = new Date(value);
  const relativeLabel = formatRelativeTime(date, now);
  const absoluteLabel = localTimestampFormatter.format(date);

  return (
    <time
      dateTime={date.toISOString()}
      title={absoluteLabel}
      suppressHydrationWarning
      className={cn("tabular-nums", className)}
    >
      {relativeLabel}
    </time>
  );
};

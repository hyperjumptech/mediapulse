"use client";

import { cn } from "@workspace/ui/lib/utils";

import { useDateTimeLabels } from "@/hooks/use-date-time";
import {
  EMPTY_DATE_TIME_LABEL,
  type DateTimeInput,
  type DateTimeStyle,
} from "@/lib/date-time/format-date-time";

export type DateTimeVariant = "absolute" | "relative" | "both";

export type DateTimeProps = {
  value: DateTimeInput;
  variant?: DateTimeVariant;
  style?: DateTimeStyle;
  timeZone?: string;
  className?: string;
};

export const DateTime = ({
  value,
  variant = "absolute",
  style = "compact",
  timeZone,
  className,
}: DateTimeProps) => {
  const labels = useDateTimeLabels(value, { style, timeZone });

  if (!labels) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {EMPTY_DATE_TIME_LABEL}
      </span>
    );
  }

  if (variant === "both") {
    return (
      <time
        dateTime={labels.iso}
        title={labels.full}
        className={cn(
          "inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums",
          className,
        )}
      >
        <span>{labels.absolute}</span>{" "}
        <span className="text-xs text-muted-foreground">{labels.relative}</span>
      </time>
    );
  }

  const text = variant === "relative" ? labels.relative : labels.absolute;

  return (
    <time
      dateTime={labels.iso}
      title={labels.full}
      className={cn("tabular-nums", className)}
    >
      {text}
    </time>
  );
};

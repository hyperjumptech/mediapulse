import type { ExecutionStatusCounts } from "@/lib/dashboard-overview";

export type TrendDirection = "up" | "down" | "flat";

export type Trend = {
  direction: TrendDirection;
  label: string;
};

const toDirection = (difference: number): TrendDirection => {
  if (difference > 0) {
    return "up";
  }
  if (difference < 0) {
    return "down";
  }

  return "flat";
};

const formatSigned = (value: number, suffix: string): string => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";

  return `${sign}${rounded}${suffix}`;
};

export const buildCountTrend = (current: number, previous: number): Trend => {
  const difference = current - previous;
  if (previous === 0) {
    return {
      direction: toDirection(difference),
      label: difference === 0 ? "0%" : "new",
    };
  }

  return {
    direction: toDirection(difference),
    label: formatSigned((difference / previous) * 100, "%"),
  };
};

export const completedRunCount = (counts: ExecutionStatusCounts): number =>
  counts.succeeded + counts.failed + counts.cancelled;

export const successRate = (counts: ExecutionStatusCounts): number | null => {
  const completed = completedRunCount(counts);

  return completed === 0 ? null : (counts.succeeded / completed) * 100;
};

export const buildRateTrend = (
  current: number | null,
  previous: number | null,
): Trend | null => {
  if (current === null || previous === null) {
    return null;
  }
  const difference = current - previous;

  return {
    direction: toDirection(difference),
    label: formatSigned(difference, " pts"),
  };
};

export const formatPercent = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value * 10) / 10}%`;

const MINUTE_IN_MILLISECONDS = 60_000;
const HOUR_IN_MILLISECONDS = 60 * MINUTE_IN_MILLISECONDS;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;

const formatCompactSpan = (milliseconds: number): string => {
  if (milliseconds < HOUR_IN_MILLISECONDS) {
    return `${Math.floor(milliseconds / MINUTE_IN_MILLISECONDS)}m`;
  }
  if (milliseconds < DAY_IN_MILLISECONDS) {
    return `${Math.floor(milliseconds / HOUR_IN_MILLISECONDS)}h`;
  }

  return `${Math.floor(milliseconds / DAY_IN_MILLISECONDS)}d`;
};

export const formatRelativeTime = (date: Date, now: Date): string => {
  const differenceInMilliseconds = date.getTime() - now.getTime();
  const isFuture = differenceInMilliseconds > 0;
  const absoluteDifference = Math.abs(differenceInMilliseconds);
  if (absoluteDifference < MINUTE_IN_MILLISECONDS) {
    return isFuture ? "in <1m" : "just now";
  }
  const compactSpan = formatCompactSpan(absoluteDifference);

  return isFuture ? `in ${compactSpan}` : `${compactSpan} ago`;
};

/**
 * Formats a millisecond delta as a compact human-readable activity step duration.
 *
 * @param ms - Elapsed milliseconds (non-negative).
 * @returns Compact label such as `< 1s`, `45s`, `1m 23s`, or `2h 4m`.
 */
export const formatActivityDuration = (ms: number): string => {
  if (ms < 1000) {
    return "< 1s";
  }

  const secTotal = Math.floor(ms / 1000);
  if (secTotal < 60) {
    return `${secTotal}s`;
  }

  const minTotal = Math.floor(secTotal / 60);
  const sec = secTotal % 60;
  if (minTotal < 60) {
    return sec > 0 ? `${minTotal}m ${sec}s` : `${minTotal}m`;
  }

  const hours = Math.floor(minTotal / 60);
  const min = minTotal % 60;
  return min > 0 ? `${hours}h ${min}m` : `${hours}h`;
};

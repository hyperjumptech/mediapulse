const dayKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDayKeyFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = dayKeyFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });
  dayKeyFormatterCache.set(timeZone, formatter);

  return formatter;
};

export const toDayKey = (date: Date, timeZone: string): string =>
  getDayKeyFormatter(timeZone).format(date);

export const buildTrailingDayKeys = (
  lastDayKey: string,
  dayCount: number,
): string[] => {
  const [year, month, day] = lastDayKey.split("-").map(Number);

  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - 1 - index;
    const date = new Date(
      Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) - offset),
    );

    return date.toISOString().slice(0, 10);
  });
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const formatDayKey = (dayKey: string): string =>
  dayLabelFormatter.format(new Date(`${dayKey}T00:00:00Z`));

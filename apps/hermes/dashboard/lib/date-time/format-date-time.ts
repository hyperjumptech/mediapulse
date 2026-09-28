export type DateTimeStyle = "datetime" | "date" | "time" | "compact";

export type DateTimeInput = Date | string | number | null | undefined;

export const EMPTY_DATE_TIME_LABEL = "—";

const FORMAT_LOCALE = "en-US";

const STYLE_OPTIONS: Record<
  Exclude<DateTimeStyle, "compact">,
  Intl.DateTimeFormatOptions
> = {
  datetime: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
  date: { year: "numeric", month: "short", day: "numeric" },
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
};

const COMPACT_SAME_YEAR_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

const YEAR_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric" };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (
  timeZone: string,
  cacheKey: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat => {
  const key = `${timeZone}|${cacheKey}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(FORMAT_LOCALE, {
    ...options,
    timeZone,
  });
  formatterCache.set(key, formatter);

  return formatter;
};

export const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  if (value === "") {
    return null;
  }
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameYearInTimeZone = (
  date: Date,
  now: Date,
  timeZone: string,
): boolean => {
  const yearFormatter = getFormatter(timeZone, "year", YEAR_OPTIONS);

  return yearFormatter.format(date) === yearFormatter.format(now);
};

export type FormatDateTimeOptions = {
  timeZone: string;
  style?: DateTimeStyle;
  now?: Date;
};

export const formatDateTime = (
  value: DateTimeInput,
  { timeZone, style = "datetime", now = new Date() }: FormatDateTimeOptions,
): string => {
  const date = toValidDate(value);
  if (!date) {
    return EMPTY_DATE_TIME_LABEL;
  }

  if (style === "compact") {
    const formatter = isSameYearInTimeZone(date, now, timeZone)
      ? getFormatter(timeZone, "compact", COMPACT_SAME_YEAR_OPTIONS)
      : getFormatter(timeZone, "datetime", STYLE_OPTIONS.datetime);

    return formatter.format(date);
  }

  return getFormatter(timeZone, style, STYLE_OPTIONS[style]).format(date);
};

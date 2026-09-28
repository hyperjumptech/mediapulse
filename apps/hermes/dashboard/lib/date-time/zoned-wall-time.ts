const WALL_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;

const PART_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const readZonedParts = (date: Date, timeZone: string): ZonedParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    ...PART_OPTIONS,
    timeZone,
  }).formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);

    return Number(part?.value ?? 0);
  };

  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    hour: readPart("hour"),
    minute: readPart("minute"),
    second: readPart("second"),
  };
};

const getTimeZoneOffsetMilliseconds = (
  instant: number,
  timeZone: string,
): number => {
  const wholeSecondInstant = instant - (((instant % 1000) + 1000) % 1000);
  const parts = readZonedParts(new Date(wholeSecondInstant), timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedAsUtc - wholeSecondInstant;
};

export const wallTimeToUtc = (
  wallTime: string,
  timeZone: string,
): Date | null => {
  const match = WALL_TIME_PATTERN.exec(wallTime.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  const wallTimeAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );
  const firstGuess =
    wallTimeAsUtc - getTimeZoneOffsetMilliseconds(wallTimeAsUtc, timeZone);
  const settledInstant =
    wallTimeAsUtc - getTimeZoneOffsetMilliseconds(firstGuess, timeZone);

  return new Date(settledInstant);
};

const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

export const utcToWallTime = (
  value: Date | string,
  timeZone: string,
): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = readZonedParts(date, timeZone);
  const datePart = `${parts.year}-${padTwoDigits(parts.month)}-${padTwoDigits(parts.day)}`;
  const timePart = `${padTwoDigits(parts.hour)}:${padTwoDigits(parts.minute)}`;

  return `${datePart}T${timePart}`;
};

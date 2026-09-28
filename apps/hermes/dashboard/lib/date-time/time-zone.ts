export const TIME_ZONE_COOKIE = "hermes_tz";

export const FALLBACK_TIME_ZONE = "UTC";

const ZERO_OFFSET_LABELS = new Set(["GMT", "GMT+0", "UTC", "UTC+0"]);

export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });

    return true;
  } catch {
    return false;
  }
};

export const resolveTimeZone = (
  ...candidates: Array<string | null | undefined>
): string => {
  const validTimeZone = candidates.find(isValidTimeZone);

  return validTimeZone ?? FALLBACK_TIME_ZONE;
};

export const readBrowserTimeZone = (): string | null => {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return isValidTimeZone(browserTimeZone) ? browserTimeZone : null;
};

export const formatTimeZoneOffset = (
  timeZone: string,
  referenceDate: Date,
): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(referenceDate);
  const offsetPart = parts.find((part) => part.type === "timeZoneName");
  const offset = offsetPart?.value ?? timeZone;

  return ZERO_OFFSET_LABELS.has(offset) ? "UTC" : offset;
};

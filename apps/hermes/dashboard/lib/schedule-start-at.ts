import { toValidDate } from "@/lib/date-time/format-date-time";
import { wallTimeToUtc } from "@/lib/date-time/zoned-wall-time";

const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const INVALID_SCHEDULE_START_AT_MESSAGE =
  "Start date/time is not a valid date.";

export type ScheduleStartAtInput = Date | string | null | undefined;

export type ScheduleStartAtResolution =
  | { ok: true; startAt: Date | null | undefined }
  | { ok: false };

const parseStartAtText = (text: string, timeZone: string): Date | null => {
  if (EXPLICIT_OFFSET_PATTERN.test(text)) {
    return toValidDate(text);
  }
  if (DATE_ONLY_PATTERN.test(text)) {
    return wallTimeToUtc(`${text}T00:00`, timeZone);
  }

  return wallTimeToUtc(text, timeZone);
};

export const resolveScheduleStartAt = (
  input: ScheduleStartAtInput,
  timeZone: string,
): ScheduleStartAtResolution => {
  if (input === undefined || input === null) {
    return { ok: true, startAt: input };
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime())
      ? { ok: false }
      : { ok: true, startAt: input };
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: true, startAt: null };
  }
  const startAt = parseStartAtText(trimmed, timeZone);

  return startAt ? { ok: true, startAt } : { ok: false };
};

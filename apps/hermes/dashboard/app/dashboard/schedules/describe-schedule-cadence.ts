const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const HOURLY_INTERVAL_MILLISECONDS = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const DAILY_AT_MIDNIGHT_CRON = "0 0 * * *";
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_MINUTE = 59;
const MAX_HOUR = 23;

type ScheduleCadenceSource = {
  repeat: "once" | "repeating";
  interval: number | null;
  cronExpression: string | null;
};

export type ScheduleCadence = {
  label: string;
  isCronExpression: boolean;
};

const describeInterval = (intervalMilliseconds: number): string => {
  const intervalMinutes = Math.max(
    1,
    Math.round(intervalMilliseconds / MILLISECONDS_PER_MINUTE),
  );
  if (intervalMinutes === MINUTES_PER_HOUR) {
    return "Hourly";
  }
  if (intervalMinutes === MINUTES_PER_DAY) {
    return "Daily";
  }
  if (intervalMinutes % MINUTES_PER_DAY === 0) {
    return `Every ${intervalMinutes / MINUTES_PER_DAY}d`;
  }
  if (intervalMinutes % MINUTES_PER_HOUR === 0) {
    return `Every ${intervalMinutes / MINUTES_PER_HOUR}h`;
  }

  return `Every ${intervalMinutes}m`;
};

const readCronNumber = (field: string, max: number): number | null => {
  if (!/^\d{1,2}$/.test(field)) {
    return null;
  }
  const value = Number(field);

  return value <= max ? value : null;
};

const padTimePart = (value: number) => String(value).padStart(2, "0");

const describeCronDays = (dayOfWeek: string, time: string): string | null => {
  if (dayOfWeek === "*") {
    return `Daily at ${time}`;
  }
  if (dayOfWeek === "1-5") {
    return `Weekdays at ${time}`;
  }
  const weekday = readCronNumber(dayOfWeek, WEEKDAY_NAMES.length - 1);
  if (weekday === null) {
    return null;
  }

  return `Every ${WEEKDAY_NAMES[weekday]} at ${time}`;
};

const describeCronExpression = (cronExpression: string): string | null => {
  const fields = cronExpression.split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = fields;
  const minute = readCronNumber(minuteField ?? "", MAX_MINUTE);
  if (minute === null || dayOfMonth !== "*" || month !== "*") {
    return null;
  }
  if (hourField === "*") {
    return dayOfWeek === "*" ? `Hourly at :${padTimePart(minute)}` : null;
  }
  const hour = readCronNumber(hourField ?? "", MAX_HOUR);
  if (hour === null) {
    return null;
  }

  return describeCronDays(
    dayOfWeek ?? "",
    `${padTimePart(hour)}:${padTimePart(minute)}`,
  );
};

export const describeScheduleCadence = ({
  repeat,
  interval,
  cronExpression,
}: ScheduleCadenceSource): ScheduleCadence => {
  if (repeat === "once") {
    return { label: "Once", isCronExpression: false };
  }
  const trimmedCronExpression = cronExpression?.trim() ?? "";
  const hasInterval = typeof interval === "number" && interval > 0;
  if (hasInterval && interval === HOURLY_INTERVAL_MILLISECONDS) {
    return { label: "Hourly", isCronExpression: false };
  }
  if (trimmedCronExpression === DAILY_AT_MIDNIGHT_CRON) {
    return { label: "Daily at midnight", isCronExpression: false };
  }
  if (hasInterval) {
    return { label: describeInterval(interval), isCronExpression: false };
  }
  if (trimmedCronExpression) {
    const cronDescription = describeCronExpression(trimmedCronExpression);

    return cronDescription
      ? { label: cronDescription, isCronExpression: false }
      : { label: trimmedCronExpression, isCronExpression: true };
  }

  return { label: "Repeating", isCronExpression: false };
};

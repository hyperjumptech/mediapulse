const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const HOURLY_INTERVAL_MILLISECONDS = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const DAILY_AT_MIDNIGHT_CRON = "0 0 * * *";

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
    return { label: trimmedCronExpression, isCronExpression: true };
  }

  return { label: "Repeating", isCronExpression: false };
};

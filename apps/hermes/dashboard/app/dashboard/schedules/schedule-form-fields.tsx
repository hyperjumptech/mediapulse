"use client";

import { useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import type { getPipelinesWithSteps } from "@/lib/pipelines";
import {
  getPipelineStatus,
  type PipelineValidationResult,
} from "@/lib/pipeline-status";

/**
 * IANA zones used when `Intl.supportedValuesOf("timeZone")` is missing (older runtimes).
 */
const FALLBACK_IANA_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const;

/** Cached sorted zones from the global `Intl` (populated on first use). */
let cachedSortedZonesFromGlobalIntl: readonly string[] | null = null;

/**
 * Narrow view of `Intl` for time zone enumeration (runtime may expose
 * `supportedValuesOf` even when older `lib` typings omit it).
 */
type IntlWithTimeZoneValues = {
  supportedValuesOf?: (key: "timeZone") => string[];
};

const globalIntlForTimeZones =
  globalThis.Intl as unknown as IntlWithTimeZoneValues;

/**
 * Reads IANA time zone ids from an `Intl` implementation, sorted lexicographically.
 *
 * @param intl - `Intl` or test double with optional `supportedValuesOf`.
 * @returns Sorted zone identifiers, or the fallback list if unavailable.
 */
const readSortedIanaTimeZones = (
  intl: IntlWithTimeZoneValues,
): readonly string[] => {
  try {
    const supportedValuesOf = intl.supportedValuesOf;
    if (typeof supportedValuesOf === "function") {
      const values = supportedValuesOf.call(intl, "timeZone");
      if (Array.isArray(values) && values.length > 0) {
        return Object.freeze([...values].sort((a, b) => a.localeCompare(b)));
      }
    }
  } catch {
    // Invalid or unsupported Intl API in this environment.
  }
  return FALLBACK_IANA_TIMEZONES;
};

/**
 * Returns all IANA time zone identifiers available in the runtime (via `Intl.supportedValuesOf`),
 * sorted for display. Uses a small fallback list when that API is missing.
 *
 * @param intl - Injectable `Intl` namespace; defaults to the global one (cached).
 * @returns Readonly sorted list of IANA time zone names.
 */
export const getSupportedIanaTimeZones = (
  intl: IntlWithTimeZoneValues = globalIntlForTimeZones,
): readonly string[] => {
  if (intl === globalIntlForTimeZones) {
    if (cachedSortedZonesFromGlobalIntl === null) {
      cachedSortedZonesFromGlobalIntl = readSortedIanaTimeZones(
        globalIntlForTimeZones,
      );
    }
    return cachedSortedZonesFromGlobalIntl;
  }
  return readSortedIanaTimeZones(intl);
};

/**
 * Builds the ordered list of `<option>` values for the timezone select, ensuring
 * `defaultTimezone` appears even if it is not in `zones` (e.g. legacy DB value).
 *
 * @param defaultTimezone - Current schedule timezone (may be empty while creating).
 * @param zones - Supported zones from `getSupportedIanaTimeZones`.
 * @returns Sorted unique zone ids.
 */
export const buildTimezoneSelectOptions = (
  defaultTimezone: string,
  zones: readonly string[],
): string[] => {
  const set = new Set(zones);
  const trimmed = defaultTimezone.trim();
  if (trimmed) {
    set.add(trimmed);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

/**
 * Returns the UTC offset label for an IANA zone at `referenceDate` (e.g. `GMT-05:00`, `GMT+9`).
 *
 * @param ianaTimeZone - IANA time zone identifier.
 * @param referenceDate - Instant used for DST-aware offset (defaults to now).
 * @returns Offset string from `Intl` (e.g. `GMT-05:00`, `GMT+09:00`), or empty string if the zone is invalid.
 */
export const getTimezoneUtcOffsetLabel = (
  ianaTimeZone: string,
  referenceDate: Date = new Date(),
): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTimeZone,
      timeZoneName: "longOffset",
    });
    const part = formatter
      .formatToParts(referenceDate)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
};

/**
 * Label for a timezone `<option>`: IANA id plus UTC offset at `referenceDate`.
 *
 * @param ianaTimeZone - IANA time zone identifier.
 * @param referenceDate - Instant used for DST-aware offset (defaults to now).
 * @returns Display string such as `America/New_York (GMT-05:00)`.
 */
export const formatTimezoneSelectLabel = (
  ianaTimeZone: string,
  referenceDate: Date = new Date(),
): string => {
  const offset = getTimezoneUtcOffsetLabel(ianaTimeZone, referenceDate);
  return offset ? `${ianaTimeZone} (${offset})` : ianaTimeZone;
};

export type PipelineOption = Awaited<
  ReturnType<typeof getPipelinesWithSteps>
>[number];

/** Repeating schedule sub-type: preset or custom. */
export type RepeatingType = "hourly" | "daily-midnight" | "interval" | "cron";

const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60_000;

/**
 * Derives initial repeating type and interval minutes from stored interval (ms) and cron.
 */
const getInitialRepeatingState = (
  intervalMs: number | null | undefined,
  cron: string | null | undefined,
): {
  repeatingType: RepeatingType;
  intervalMinutes: number;
  cronExpression: string;
} => {
  if (intervalMs === MS_PER_HOUR) {
    return { repeatingType: "hourly", intervalMinutes: 60, cronExpression: "" };
  }
  if (cron?.trim() === "0 0 * * *") {
    return {
      repeatingType: "daily-midnight",
      intervalMinutes: 60,
      cronExpression: cron,
    };
  }
  if (typeof intervalMs === "number" && intervalMs > 0) {
    return {
      repeatingType: "interval",
      intervalMinutes: Math.round(intervalMs / MS_PER_MINUTE) || 1,
      cronExpression: "",
    };
  }
  if (cron?.trim()) {
    return { repeatingType: "cron", intervalMinutes: 60, cronExpression: cron };
  }
  return { repeatingType: "hourly", intervalMinutes: 60, cronExpression: "" };
};

export type ScheduleFormFieldsProps = {
  /** Hidden input name prefix, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  pipelines: PipelineOption[];
  /** Pipeline validation by id; invalid pipelines are disabled in the dropdown. */
  pipelineValidationById?: Record<string, PipelineValidationResult>;
  /** Default/initial values for all fields */
  defaultName: string;
  defaultDescription: string;
  defaultRepeat: "once" | "repeating";
  defaultTimezone: string;
  defaultPipelineId: string;
  defaultPriority: number;
  defaultEnabled: boolean;
  /** Start at as datetime-local string (empty if none). Shown when repeat is once. */
  defaultStartAt?: string;
  /** For edit: stored interval in ms. Used to derive repeating type and interval minutes. */
  initialIntervalMs?: number | null;
  /** For edit: stored cron expression. Used to derive repeating type. */
  initialCronExpression?: string | null;
  /** Edit only: schedule id for hidden input */
  scheduleId?: string;
};

/**
 * Encapsulates schedule form field state: repeat, repeating type, interval, cron, pipeline id.
 */
const useScheduleFormFieldsState = (
  defaultRepeat: "once" | "repeating",
  defaultPipelineId: string,
  initialIntervalMs?: number | null,
  initialCronExpression?: string | null,
) => {
  const initial = getInitialRepeatingState(
    initialIntervalMs,
    initialCronExpression,
  );
  const [repeat, setRepeat] = useState<"once" | "repeating">(defaultRepeat);
  const [repeatingType, setRepeatingType] = useState<RepeatingType>(
    initial.repeatingType,
  );
  const [intervalMinutes, setIntervalMinutes] = useState<number>(
    initial.intervalMinutes,
  );
  const [cronExpression, setCronExpression] = useState<string>(
    initial.cronExpression,
  );
  const [pipelineId, setPipelineId] = useState(defaultPipelineId);

  return {
    repeat,
    setRepeat,
    repeatingType,
    setRepeatingType,
    intervalMinutes,
    setIntervalMinutes,
    cronExpression,
    setCronExpression,
    pipelineId,
    setPipelineId,
  };
};

/**
 * Shared schedule form fields: name, description, repeat group (once/repeating + schedule type), timezone, pipeline, priority, enabled. Optional edit-only: scheduleId. Agent HTTP timeout is configured on the pipeline.
 */
export const ScheduleFormFields = ({
  namePrefix = "body",
  pending,
  errorMessage,
  submitLabel,
  pipelines,
  pipelineValidationById = {},
  defaultName,
  defaultDescription,
  defaultRepeat,
  defaultTimezone,
  defaultPipelineId,
  defaultPriority,
  defaultEnabled,
  defaultStartAt = "",
  initialIntervalMs,
  initialCronExpression,
  scheduleId,
}: ScheduleFormFieldsProps) => {
  const {
    repeat,
    setRepeat,
    repeatingType,
    setRepeatingType,
    intervalMinutes,
    setIntervalMinutes,
    cronExpression,
    setCronExpression,
    pipelineId,
    setPipelineId,
  } = useScheduleFormFieldsState(
    defaultRepeat,
    defaultPipelineId,
    initialIntervalMs,
    initialCronExpression,
  );

  const timezoneOptions = useMemo(
    () =>
      buildTimezoneSelectOptions(defaultTimezone, getSupportedIanaTimeZones()),
    [defaultTimezone],
  );

  const pre = namePrefix ? `${namePrefix}.` : "";

  return (
    <>
      {scheduleId != null ? (
        <input
          type="hidden"
          name={`${pre}scheduleId`}
          value={scheduleId}
          readOnly
        />
      ) : null}
      <input type="hidden" name={`${pre}repeat`} value={repeat} readOnly />
      <div className="grid gap-2">
        <Label htmlFor={`${pre}name`}>Name</Label>
        <Input
          id={`${pre}name`}
          name={`${pre}name`}
          type="text"
          required
          placeholder="e.g. Daily pipeline run"
          defaultValue={defaultName}
          disabled={pending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}description`}>Description (optional)</Label>
        <Input
          id={`${pre}description`}
          name={`${pre}description`}
          type="text"
          placeholder="What this schedule does"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </div>
      <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="grid gap-2">
          <Label htmlFor={`${pre}repeat-select`}>Repeat</Label>
          <select
            id={`${pre}repeat-select`}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as "once" | "repeating")}
            disabled={pending}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <option value="once">Once</option>
            <option value="repeating">Repeating</option>
          </select>
        </div>
        {repeat === "once" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${pre}startAt`}>Start at (optional)</Label>
            <Input
              id={`${pre}startAt`}
              name={`${pre}startAt`}
              type="datetime-local"
              defaultValue={defaultStartAt}
              disabled={pending}
            />
          </div>
        ) : null}
        {repeat === "repeating" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${pre}repeating-type`}>Schedule</Label>
            <select
              id={`${pre}repeating-type`}
              value={repeatingType}
              onChange={(e) =>
                setRepeatingType(e.target.value as RepeatingType)
              }
              disabled={pending}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <option value="hourly">Hourly</option>
              <option value="daily-midnight">Daily at midnight</option>
              <option value="interval">Interval (minutes)</option>
              <option value="cron">Cron expression</option>
            </select>
            {repeatingType === "hourly" ? (
              <input
                type="hidden"
                name={`${pre}interval`}
                value={MS_PER_HOUR}
                readOnly
              />
            ) : null}
            {repeatingType === "daily-midnight" ? (
              <input
                type="hidden"
                name={`${pre}cronExpression`}
                value="0 0 * * *"
                readOnly
              />
            ) : null}
            {repeatingType === "interval" ? (
              <>
                <input
                  type="hidden"
                  name={`${pre}cronExpression`}
                  value=""
                  readOnly
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${pre}intervalMinutes`}>
                    Interval (minutes)
                  </Label>
                  <Input
                    id={`${pre}intervalMinutes`}
                    type="number"
                    min={1}
                    value={intervalMinutes}
                    onChange={(e) =>
                      setIntervalMinutes(Number(e.target.value) || 1)
                    }
                    placeholder="e.g. 60"
                    disabled={pending}
                    required
                  />
                  <input
                    type="hidden"
                    name={`${pre}interval`}
                    value={intervalMinutes * MS_PER_MINUTE}
                    readOnly
                  />
                </div>
              </>
            ) : null}
            {repeatingType === "cron" ? (
              <div className="grid gap-2">
                <Label htmlFor={`${pre}cronExpression`}>Cron expression</Label>
                <Input
                  id={`${pre}cronExpression`}
                  name={`${pre}cronExpression`}
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="e.g. 0 6 * * * (daily at 06:00)"
                  disabled={pending}
                  required
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}timezone`}>Timezone</Label>
        <select
          id={`${pre}timezone`}
          name={`${pre}timezone`}
          required
          defaultValue={defaultTimezone}
          disabled={pending}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {formatTimezoneSelectLabel(tz)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}pipelineId`}>Pipeline</Label>
        <select
          id={`${pre}pipelineId`}
          name={`${pre}pipelineId`}
          required
          value={pipelineId}
          onChange={(e) => setPipelineId(e.target.value)}
          disabled={pending}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <option value="">Select pipeline</option>
          {pipelines.map((p) => {
            const validation = pipelineValidationById[p.id] ?? {
              valid: false,
              warnings: [],
            };
            const status = getPipelineStatus(p, validation);
            const selectable = status === "enabled";
            const suffix =
              status === "incomplete"
                ? " (incomplete)"
                : status === "disabled"
                  ? " (disabled)"
                  : "";
            const title =
              status === "incomplete"
                ? "Complete step input and config in pipeline editor to enable"
                : status === "disabled"
                  ? "Enable the pipeline in pipeline settings to use in a schedule"
                  : undefined;
            return (
              <option
                key={p.id}
                value={p.id}
                disabled={!selectable}
                title={title}
              >
                {p.name}
                {suffix}
              </option>
            );
          })}
        </select>
        {Object.keys(pipelineValidationById).length > 0 &&
          (Object.values(pipelineValidationById).some((v) => !v.valid) ||
            pipelines.some((p) => !p.isActive)) && (
            <p className="text-xs text-muted-foreground">
              Only enabled pipelines can be selected. Incomplete or disabled
              pipelines are listed but not selectable. Edit the pipeline to fix
              or enable it.
            </p>
          )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}priority`}>
          Priority {scheduleId == null ? "(default 0)" : ""}
        </Label>
        <Input
          id={`${pre}priority`}
          name={`${pre}priority`}
          type="number"
          defaultValue={defaultPriority}
          disabled={pending}
        />
      </div>
      <FormBooleanCheckboxField
        name={`${pre}enabled`}
        id={`${pre}enabled`}
        defaultChecked={defaultEnabled}
        checkedSubmitValue="on"
        disabled={pending}
        label="Enabled"
        labelClassName="cursor-pointer"
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </>
  );
};

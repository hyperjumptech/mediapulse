"use client";

import { useMemo, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import type { PipelineOption } from "@/lib/pipeline-options";
import {
  getPipelineStatus,
  type PipelineStatus,
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

export type { PipelineOption };

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

type RepeatOption = "once" | "repeating";

type PipelineSelectOption = {
  id: string;
  label: string;
  selectable: boolean;
  title: string | undefined;
};

const PIPELINE_STATUS_SUFFIX: Record<PipelineStatus, string> = {
  enabled: "",
  incomplete: " (incomplete)",
  disabled: " (disabled)",
};

const PIPELINE_STATUS_TITLE: Record<PipelineStatus, string | undefined> = {
  enabled: undefined,
  incomplete: "Complete step input and config in pipeline editor to enable",
  disabled: "Enable the pipeline in pipeline settings to use in a schedule",
};

const buildPipelineSelectOptions = (
  pipelines: PipelineOption[],
  pipelineValidationById: Record<string, PipelineValidationResult>,
): PipelineSelectOption[] =>
  pipelines.map((pipeline) => {
    const validation = pipelineValidationById[pipeline.id] ?? {
      valid: false,
      warnings: [],
    };
    const status = getPipelineStatus(pipeline, validation);
    const suffix = PIPELINE_STATUS_SUFFIX[status];

    return {
      id: pipeline.id,
      label: `${pipeline.name}${suffix}`,
      selectable: status === "enabled",
      title: PIPELINE_STATUS_TITLE[status],
    };
  });

const hasUnselectablePipelines = (
  pipelines: PipelineOption[],
  pipelineValidationById: Record<string, PipelineValidationResult>,
): boolean => {
  const validations = Object.values(pipelineValidationById);

  if (validations.length === 0) {
    return false;
  }

  const hasInvalidPipeline = validations.some(
    (validation) => !validation.valid,
  );
  const hasInactivePipeline = pipelines.some((pipeline) => !pipeline.isActive);

  return hasInvalidPipeline || hasInactivePipeline;
};

export type ScheduleFormFieldsProps = {
  /** Hidden input name prefix, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  pipelines: PipelineOption[];
  /** Pipeline validation by id; invalid pipelines are disabled in the dropdown. */
  pipelineValidationById?: Record<string, PipelineValidationResult>;
  /** Default/initial values for all fields */
  defaultName: string;
  defaultDescription: string;
  defaultRepeat: RepeatOption;
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
  defaultRepeat: RepeatOption,
  defaultPipelineId: string,
  initialIntervalMs?: number | null,
  initialCronExpression?: string | null,
) => {
  const initial = getInitialRepeatingState(
    initialIntervalMs,
    initialCronExpression,
  );
  const [repeat, setRepeat] = useState<RepeatOption>(defaultRepeat);
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
  const pipelineSelectOptions = buildPipelineSelectOptions(
    pipelines,
    pipelineValidationById,
  );
  const showPipelineSelectionHint = hasUnselectablePipelines(
    pipelines,
    pipelineValidationById,
  );
  const priorityLabelSuffix = scheduleId == null ? "(default 0)" : "";

  const pre = namePrefix ? `${namePrefix}.` : "";

  return (
    <FieldGroup>
      {scheduleId != null ? (
        <input
          type="hidden"
          name={`${pre}scheduleId`}
          value={scheduleId}
          readOnly
        />
      ) : null}
      <input type="hidden" name={`${pre}repeat`} value={repeat} readOnly />
      <Field>
        <FieldLabel htmlFor={`${pre}name`}>Name</FieldLabel>
        <Input
          id={`${pre}name`}
          name={`${pre}name`}
          type="text"
          required
          placeholder="e.g. Daily pipeline run"
          defaultValue={defaultName}
          disabled={pending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}description`}>
          Description (optional)
        </FieldLabel>
        <Input
          id={`${pre}description`}
          name={`${pre}description`}
          type="text"
          placeholder="What this schedule does"
          defaultValue={defaultDescription}
          disabled={pending}
        />
      </Field>
      <div className="flex flex-col gap-5 rounded-lg border bg-muted/30 p-4">
        <Field>
          <FieldLabel htmlFor={`${pre}repeat-select`}>Repeat</FieldLabel>
          <NativeSelect
            id={`${pre}repeat-select`}
            value={repeat}
            onChange={(event) => setRepeat(event.target.value as RepeatOption)}
            disabled={pending}
          >
            <NativeSelectOption value="once">Once</NativeSelectOption>
            <NativeSelectOption value="repeating">Repeating</NativeSelectOption>
          </NativeSelect>
        </Field>
        {repeat === "once" ? (
          <Field>
            <FieldLabel htmlFor={`${pre}startAt`}>
              Start at (optional)
            </FieldLabel>
            <Input
              id={`${pre}startAt`}
              name={`${pre}startAt`}
              type="datetime-local"
              defaultValue={defaultStartAt}
              disabled={pending}
            />
          </Field>
        ) : null}
        {repeat === "repeating" ? (
          <Field>
            <FieldLabel htmlFor={`${pre}repeating-type`}>Schedule</FieldLabel>
            <NativeSelect
              id={`${pre}repeating-type`}
              value={repeatingType}
              onChange={(event) =>
                setRepeatingType(event.target.value as RepeatingType)
              }
              disabled={pending}
            >
              <NativeSelectOption value="hourly">Hourly</NativeSelectOption>
              <NativeSelectOption value="daily-midnight">
                Daily at midnight
              </NativeSelectOption>
              <NativeSelectOption value="interval">
                Interval (minutes)
              </NativeSelectOption>
              <NativeSelectOption value="cron">
                Cron expression
              </NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : null}
        {repeat === "repeating" && repeatingType === "hourly" ? (
          <input
            type="hidden"
            name={`${pre}interval`}
            value={MS_PER_HOUR}
            readOnly
          />
        ) : null}
        {repeat === "repeating" && repeatingType === "daily-midnight" ? (
          <input
            type="hidden"
            name={`${pre}cronExpression`}
            value="0 0 * * *"
            readOnly
          />
        ) : null}
        {repeat === "repeating" && repeatingType === "interval" ? (
          <Field>
            <input
              type="hidden"
              name={`${pre}cronExpression`}
              value=""
              readOnly
            />
            <FieldLabel htmlFor={`${pre}intervalMinutes`}>
              Interval (minutes)
            </FieldLabel>
            <Input
              id={`${pre}intervalMinutes`}
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(event) =>
                setIntervalMinutes(Number(event.target.value) || 1)
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
          </Field>
        ) : null}
        {repeat === "repeating" && repeatingType === "cron" ? (
          <Field>
            <FieldLabel htmlFor={`${pre}cronExpression`}>
              Cron expression
            </FieldLabel>
            <Input
              id={`${pre}cronExpression`}
              name={`${pre}cronExpression`}
              type="text"
              value={cronExpression}
              onChange={(event) => setCronExpression(event.target.value)}
              placeholder="e.g. 0 6 * * * (daily at 06:00)"
              disabled={pending}
              required
            />
          </Field>
        ) : null}
      </div>
      <Field>
        <FieldLabel htmlFor={`${pre}timezone`}>Timezone</FieldLabel>
        <NativeSelect
          id={`${pre}timezone`}
          name={`${pre}timezone`}
          required
          defaultValue={defaultTimezone}
          disabled={pending}
        >
          {timezoneOptions.map((timezone) => (
            <NativeSelectOption key={timezone} value={timezone}>
              {formatTimezoneSelectLabel(timezone)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}pipelineId`}>Pipeline</FieldLabel>
        <NativeSelect
          id={`${pre}pipelineId`}
          name={`${pre}pipelineId`}
          required
          value={pipelineId}
          onChange={(event) => setPipelineId(event.target.value)}
          disabled={pending}
        >
          <NativeSelectOption value="">Select pipeline</NativeSelectOption>
          {pipelineSelectOptions.map((option) => (
            <NativeSelectOption
              key={option.id}
              value={option.id}
              disabled={!option.selectable}
              title={option.title}
            >
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {showPipelineSelectionHint ? (
          <FieldDescription>
            Only enabled pipelines can be selected. Incomplete or disabled
            pipelines are listed but not selectable. Edit the pipeline to fix or
            enable it.
          </FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${pre}priority`}>
          Priority {priorityLabelSuffix}
        </FieldLabel>
        <Input
          id={`${pre}priority`}
          name={`${pre}priority`}
          type="number"
          defaultValue={defaultPriority}
          disabled={pending}
        />
      </Field>
      <FormBooleanCheckboxField
        name={`${pre}enabled`}
        id={`${pre}enabled`}
        defaultChecked={defaultEnabled}
        checkedSubmitValue="on"
        disabled={pending}
        label="Enabled"
      />
    </FieldGroup>
  );
};

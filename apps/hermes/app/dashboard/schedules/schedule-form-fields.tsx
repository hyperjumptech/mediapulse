"use client";

import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import type { getPipelinesWithSteps } from "@/lib/pipelines";

/** Common IANA timezone identifiers for schedule runs. */
export const TIMEZONE_OPTIONS = [
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
function getInitialRepeatingState(
  intervalMs: number | null | undefined,
  cron: string | null | undefined,
): {
  repeatingType: RepeatingType;
  intervalMinutes: number;
  cronExpression: string;
} {
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
}

export type ScheduleFormFieldsProps = {
  /** Hidden input name prefix, e.g. "body" for body.name */
  namePrefix?: string;
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  pipelines: PipelineOption[];
  /** Default/initial values for all fields */
  defaultName: string;
  defaultDescription: string;
  defaultRepeat: "once" | "repeating";
  defaultTimezone: string;
  defaultPipelineId: string;
  defaultParams: string;
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
  /** Edit only: retry config JSON string */
  defaultRetryConfig?: string;
  /** Edit only: timeout in ms */
  defaultTimeout?: number | null;
};

/**
 * Shared schedule form fields: name, description, repeat group (once/repeating + schedule type), timezone, pipeline, params, priority, enabled. Optional edit-only: scheduleId, retryConfig, timeout.
 */
export const ScheduleFormFields = ({
  namePrefix = "body",
  pending,
  errorMessage,
  submitLabel,
  pipelines,
  defaultName,
  defaultDescription,
  defaultRepeat,
  defaultTimezone,
  defaultPipelineId,
  defaultParams,
  defaultPriority,
  defaultEnabled,
  defaultStartAt = "",
  initialIntervalMs,
  initialCronExpression,
  scheduleId,
  defaultRetryConfig = "",
  defaultTimeout,
}: ScheduleFormFieldsProps) => {
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
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
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
          defaultValue={defaultPipelineId}
          disabled={pending}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <option value="">Select pipeline</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${pre}params`}>Params (JSON)</Label>
        <textarea
          id={`${pre}params`}
          name={`${pre}params`}
          defaultValue={defaultParams}
          rows={4}
          disabled={pending}
          placeholder='{"tickerId": "db:ticker:all:id"}'
          className={cn(
            "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        />
      </div>
      {scheduleId != null ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`${pre}retryConfig`}>
              Retry config (JSON, optional)
            </Label>
            <textarea
              id={`${pre}retryConfig`}
              name={`${pre}retryConfig`}
              defaultValue={defaultRetryConfig}
              rows={3}
              disabled={pending}
              placeholder="{} or leave empty"
              className={cn(
                "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${pre}timeout`}>Timeout (ms, optional)</Label>
            <Input
              id={`${pre}timeout`}
              name={`${pre}timeout`}
              type="number"
              min={1}
              defaultValue={defaultTimeout ?? ""}
              disabled={pending}
            />
          </div>
        </>
      ) : null}
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
      <div className="flex items-center gap-2">
        <input type="hidden" name={`${pre}enabled`} value="false" readOnly />
        <input
          id={`${pre}enabled`}
          name={`${pre}enabled`}
          type="checkbox"
          defaultChecked={defaultEnabled}
          value="on"
          disabled={pending}
          className="size-4 rounded border-input"
        />
        <Label htmlFor={`${pre}enabled`} className="cursor-pointer">
          Enabled
        </Label>
      </div>
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

"use server";

import { getScheduleById } from "@/lib/schedules";

/**
 * Serializable schedule shape for the edit form (dates as ISO strings).
 */
export type ScheduleForEdit = {
  id: string;
  name: string;
  description: string | null;
  repeat: "once" | "repeating";
  cronExpression: string | null;
  interval: number | null;
  timezone: string;
  startAt: string | null;
  pipelineId: string;
  retryConfig: Record<string, unknown> | null;
  timeout: number | null;
  priority: number;
  enabled: boolean;
};

/**
 * Fetches a schedule by id for the edit modal. Returns null if not found.
 * Used by the client to load schedule data when opening the edit modal.
 *
 * @param scheduleId - UUID of the schedule.
 * @returns Serialized schedule or null.
 */
export const getScheduleForEdit = async (
  scheduleId: string,
): Promise<ScheduleForEdit | null> => {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) return null;

  const toJson = (v: unknown): Record<string, unknown> | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return null;
  };

  return {
    id: schedule.id,
    name: schedule.name,
    description: schedule.description,
    repeat: schedule.repeat,
    cronExpression: schedule.cronExpression,
    interval: schedule.interval,
    timezone: schedule.timezone,
    startAt: schedule.startAt?.toISOString() ?? null,
    pipelineId: schedule.pipelineId,
    retryConfig: toJson(schedule.retryConfig),
    timeout: schedule.timeout,
    priority: schedule.priority,
    enabled: schedule.enabled,
  };
};

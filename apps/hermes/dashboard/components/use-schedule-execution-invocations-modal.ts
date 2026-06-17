"use client";

import { useCallback, useState } from "react";

/** One invocation row prepared for the schedule execution table (values already secret-masked server-side). */
export type ScheduleExecutionInvocationRow = {
  jobId: string;
  status: string;
  semanticStatus: string | null;
  /** Unified Reason column text (transport + semantic + run warnings). */
  outcomeSummary: string | null;
  /** Raw transport/HTTP error JSON for the detail modal. */
  transportError: unknown | null;
  /** Parsed agent envelope stored on the job execution row. */
  agentResponse: unknown | null;
  inputMasked: unknown;
  configMasked: unknown | null;
  /** Agent package id for this job. */
  agentId: string;
  /** ISO-8601 timestamp when the job started, or null if not recorded yet. */
  startedAtIso: string | null;
  /** ISO-8601 timestamp when the job finished, or null if not terminal yet. */
  completedAtIso: string | null;
  /** DataQueue `attempts` when the worker last synced; null if unknown (legacy). */
  dataQueueAttempts: number | null;
  /** DataQueue `max_attempts` when last synced; null if unknown. */
  dataQueueMaxAttempts: number | null;
};

/**
 * Controls the invocation detail dialog: which row is selected and open state.
 *
 * @returns Dialog state, selected row, and handlers for opening and closing.
 */
export const useScheduleExecutionInvocationsModal = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] =
    useState<ScheduleExecutionInvocationRow | null>(null);

  const openModal = useCallback((row: ScheduleExecutionInvocationRow) => {
    setSelected(row);
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setSelected(null);
    }
  }, []);

  return { open, selected, openModal, onOpenChange };
};

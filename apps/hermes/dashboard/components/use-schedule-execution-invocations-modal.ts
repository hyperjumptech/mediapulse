"use client";

import { useCallback, useState } from "react";

/** One invocation row prepared for the schedule execution table (values already secret-masked server-side). */
export type ScheduleExecutionInvocationRow = {
  jobId: string;
  status: string;
  semanticStatus: string | null;
  errorSummary: string | null;
  inputMasked: unknown;
  configMasked: unknown | null;
  /** Agent package id for this job. */
  agentId: string;
  /** ISO-8601 timestamp when the job started, or null if not recorded yet. */
  startedAtIso: string | null;
  /** ISO-8601 timestamp when the job finished, or null if not terminal yet. */
  completedAtIso: string | null;
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

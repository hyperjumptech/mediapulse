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

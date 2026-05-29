"use client";

import { useCallback, useState } from "react";

import { fetchAgentActivitiesAction } from "@/app/dashboard/executions/agent-activity-actions";
import {
  attachActivityRowDurations,
  type ActivityRow,
} from "@/lib/derive-activity-row-durations";

export type { ActivityRow } from "@/lib/derive-activity-row-durations";

/**
 * Controls the agent activity dialog: async fetch on open and reset on close.
 *
 * @returns Dialog state, fetched rows, loading flag, and open/close handlers.
 */
export const useAgentActivityModal = () => {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const openModal = useCallback(async (nextJobId: string) => {
    setJobId(nextJobId);
    setOpen(true);
    setLoading(true);
    setRows(null);

    try {
      const data = await fetchAgentActivitiesAction(nextJobId);
      setRows(attachActivityRowDurations(data));
    } finally {
      setLoading(false);
    }
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setJobId(null);
      setRows(null);
      setLoading(false);
    }
  }, []);

  return { open, jobId, rows, loading, openModal, onOpenChange };
};

"use client";

import { useCallback, useRef, useState } from "react";

import {
  fetchInvocationPayloadAction,
  type InvocationPayload,
  type InvocationPayloadSource,
} from "@/app/dashboard/executions/invocation-payload-actions";

export type {
  InvocationPayload,
  InvocationPayloadSource,
} from "@/app/dashboard/executions/invocation-payload-actions";

/** One invocation row prepared for the schedule execution table. */
export type ScheduleExecutionInvocationRow = {
  jobId: string;
  status: string;
  semanticStatus: string | null;
  /** Unified Reason column text (transport + semantic + run warnings). */
  outcomeSummary: string | null;
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

const PAYLOAD_NOT_FOUND_MESSAGE =
  "This invocation's details are no longer available.";

const PAYLOAD_LOAD_FAILED_MESSAGE =
  "Could not load this invocation's details. Close the dialog and try again.";

/**
 * Controls the invocation detail dialog: which row is selected and open state.
 *
 * @returns Dialog state, selected row, and handlers for opening and closing.
 */
export const useScheduleExecutionInvocationsModal = (
  payloadSource: InvocationPayloadSource,
) => {
  const { kind, parentId, executionId } = payloadSource;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] =
    useState<ScheduleExecutionInvocationRow | null>(null);
  const [payload, setPayload] = useState<InvocationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const openModal = useCallback(
    async (row: ScheduleExecutionInvocationRow) => {
      latestRequestIdRef.current += 1;
      const requestId = latestRequestIdRef.current;
      const isLatestRequest = () => requestId === latestRequestIdRef.current;
      const request = { kind, parentId, executionId, jobId: row.jobId };
      setSelected(row);
      setOpen(true);
      setPayload(null);
      setErrorMessage(null);
      setLoading(true);

      try {
        const loadedPayload = await fetchInvocationPayloadAction(request);
        if (isLatestRequest()) {
          setPayload(loadedPayload);
          setErrorMessage(
            loadedPayload == null ? PAYLOAD_NOT_FOUND_MESSAGE : null,
          );
        }
      } catch {
        if (isLatestRequest()) {
          setErrorMessage(PAYLOAD_LOAD_FAILED_MESSAGE);
        }
      } finally {
        if (isLatestRequest()) {
          setLoading(false);
        }
      }
    },
    [kind, parentId, executionId],
  );

  const onOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      latestRequestIdRef.current += 1;
      setSelected(null);
      setPayload(null);
      setErrorMessage(null);
      setLoading(false);
    }
  }, []);

  return {
    open,
    selected,
    payload,
    loading,
    errorMessage,
    openModal,
    onOpenChange,
  };
};

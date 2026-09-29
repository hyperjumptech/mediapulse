"use client";

import { useCallback, useState } from "react";

import type { formAction as addPipelineStepFormAction } from "@/app/dashboard/pipelines/actions/add-pipeline-step/.generated/form.action";

export type AddPipelineStepFormAction = typeof addPipelineStepFormAction;

const readErrorMessage = (state: unknown): string | null => {
  const isFailedState =
    state != null &&
    typeof state === "object" &&
    "status" in state &&
    state.status === false &&
    "message" in state;

  return isFailedState ? String(state.message) : null;
};

export const usePipelineAvailablePipelinesState = (
  pipelineId: string,
  addPipelineStepFormAction: AddPipelineStepFormAction,
) => {
  const [state, setState] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const handleAddPipeline = useCallback(
    async (targetPipelineId: string) => {
      setPending(true);
      setState(null);
      try {
        const formData = new FormData();
        formData.set("body.pipelineId", pipelineId);
        formData.set("body.targetPipelineId", targetPipelineId);
        const result = await addPipelineStepFormAction(null, formData);
        setState(result);
      } finally {
        setPending(false);
      }
    },
    [pipelineId, addPipelineStepFormAction],
  );

  return { pending, handleAddPipeline, errorMessage: readErrorMessage(state) };
};

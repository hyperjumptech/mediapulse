"use client";

import { useCallback, useState } from "react";

import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

type RunPipelineSubmitState =
  | { status: true }
  | { status: false; message: string }
  | null
  | undefined;

const isSuccessfulRun = (state: RunPipelineSubmitState): boolean =>
  Boolean(state && state.status === true);

export const useRunPipelineParamsDialog = ({
  pending,
  state,
}: {
  pending: boolean;
  state: RunPipelineSubmitState;
}) => {
  const [open, setOpen] = useState(false);
  const closeDialog = useCallback(() => setOpen(false), []);
  const errorMessage = state && state.status === false ? state.message : null;

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: isSuccessfulRun,
    onSuccess: closeDialog,
  });

  return { open, setOpen, closeDialog, errorMessage };
};

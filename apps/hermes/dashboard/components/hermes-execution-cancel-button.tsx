"use client";

import { Button } from "@workspace/ui/components/button";

import {
  type CancelTarget,
  useHermesExecutionCancelButton,
} from "@/hooks/use-hermes-execution-cancel-button";

export type { CancelTarget } from "@/hooks/use-hermes-execution-cancel-button";

type HermesExecutionCancelButtonProps = {
  target: CancelTarget;
  runStatus: string;
};

/**
 * Cancels a schedule, HTTP trigger, or manual pipeline execution when still `pending` or `running`.
 */
export const HermesExecutionCancelButton = ({
  target,
  runStatus,
}: HermesExecutionCancelButtonProps) => {
  const { isLoading, canCancel, requestCancel } =
    useHermesExecutionCancelButton(target, runStatus);

  if (!canCancel) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isLoading}
      onClick={requestCancel}
    >
      {isLoading ? "Cancelling…" : "Cancel run"}
    </Button>
  );
};

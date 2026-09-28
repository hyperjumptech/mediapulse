import { useCallback, useState } from "react";

import { isHermesExecutionCancellable } from "@/lib/hermes-execution-cancellable";
import type { ExecutionCancelTarget } from "@/lib/execution-list";

export type CancelTarget = ExecutionCancelTarget;

const cancelUrl = (target: CancelTarget): string => {
  switch (target.kind) {
    case "schedule":
      return "/dashboard/schedules/actions/cancel-execution";
    case "httpTrigger":
      return "/dashboard/http-triggers/actions/cancel-execution";
    case "manual":
      return "/dashboard/pipelines/actions/cancel-manual-execution";
  }
};

const cancelBody = (target: CancelTarget): Record<string, string> => {
  switch (target.kind) {
    case "schedule":
      return {
        scheduleId: target.scheduleId,
        scheduleExecutionId: target.scheduleExecutionId,
      };
    case "httpTrigger":
      return {
        httpTriggerId: target.httpTriggerId,
        httpTriggerExecutionId: target.httpTriggerExecutionId,
      };
    case "manual":
      return {
        pipelineId: target.pipelineId,
        manualExecutionId: target.manualExecutionId,
      };
  }
};

export type UseHermesExecutionCancelButtonResult = {
  isLoading: boolean;
  canCancel: boolean;
  requestCancel: () => void;
};

export const useHermesExecutionCancelButton = (
  target: CancelTarget,
  runStatus: string,
  refresh: () => void,
): UseHermesExecutionCancelButtonResult => {
  const [isLoading, setIsLoading] = useState(false);
  const canCancel = isHermesExecutionCancellable(runStatus);

  const requestCancel = useCallback(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(cancelUrl(target), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cancelBody(target)),
        });
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "Cancel failed");
        }
        refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Cancel failed";
        window.alert(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refresh, target]);

  return { isLoading, canCancel, requestCancel };
};

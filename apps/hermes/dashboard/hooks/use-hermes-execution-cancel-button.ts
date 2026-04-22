import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/** Identifies which Hermes execution type is being cancelled and its ids. */
export type CancelTarget =
  | { kind: "schedule"; scheduleId: string; scheduleExecutionId: string }
  | {
      kind: "httpTrigger";
      httpTriggerId: string;
      httpTriggerExecutionId: string;
    }
  | { kind: "manual"; pipelineId: string; manualExecutionId: string };

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
  /** True while the cancel POST is in flight. */
  isLoading: boolean;
  /** Cancel is only offered for non-terminal runs. */
  canCancel: boolean;
  /** Starts the cancel request (fire-and-forget safe). */
  requestCancel: () => void;
};

/**
 * Owns loading state and the cancel POST for schedule, HTTP trigger, or manual executions.
 */
export const useHermesExecutionCancelButton = (
  target: CancelTarget,
  runStatus: string,
): UseHermesExecutionCancelButtonResult => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const canCancel = runStatus === "pending" || runStatus === "running";

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
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Cancel failed";
        window.alert(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router, target]);

  return { isLoading, canCancel, requestCancel };
};

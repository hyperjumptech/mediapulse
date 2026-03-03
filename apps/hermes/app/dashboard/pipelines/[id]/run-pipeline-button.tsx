"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@workspace/ui/components/button";
import { Play } from "lucide-react";

import { useFormAction } from "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action";

/**
 * Button that runs the pipeline for all tickers (same behavior as cron). Uses run-pipeline action.
 */
export const RunPipelineButton = ({ pipelineId }: { pipelineId: string }) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  const errorMessage = state && state.status === false ? state.message : null;
  const successTickers =
    state && state.status === true && state.data
      ? (state.data as { tickersRun?: number }).tickersRun
      : null;

  return (
    <div className="flex flex-col gap-1">
      <FormWithAction>
        <input
          type="hidden"
          name="body.pipelineId"
          value={pipelineId}
          readOnly
        />
        <Button type="submit" variant="default" disabled={pending}>
          <Play className="mr-2 size-4" />
          {pending ? "Running…" : "Run pipeline"}
        </Button>
      </FormWithAction>
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
      {successTickers !== null && successTickers !== undefined && (
        <p className="text-sm text-muted-foreground">
          Ran for {successTickers} ticker{successTickers !== 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
};

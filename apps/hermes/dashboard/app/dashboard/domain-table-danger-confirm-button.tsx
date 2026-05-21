"use client";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";

import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

import { useDomainTableDangerConfirmAction } from "./use-domain-table-danger-confirm-action";

type DangerConfirmAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

export type DomainTableDangerConfirmButtonProps = {
  action: DashboardPageCustomAction;
  serverAction: DangerConfirmAction;
};

/**
 * Renders a compact destructive custom action with a browser confirm dialog before POST.
 *
 * @param props - Custom action metadata and shared server action.
 * @returns Inline confirm button form for the given action.
 */
export const DomainTableDangerConfirmButton = ({
  action,
  serverAction,
}: DomainTableDangerConfirmButtonProps) => {
  const { state, handleSubmit, isPending } = useDomainTableDangerConfirmAction({
    action,
    serverAction,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-1">
      {state.status === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-xs text-muted-foreground" role="status">
          Deleted {state.deleted} row{state.deleted === 1 ? "" : "s"}.
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Working…" : action.label}
      </Button>
    </form>
  );
};

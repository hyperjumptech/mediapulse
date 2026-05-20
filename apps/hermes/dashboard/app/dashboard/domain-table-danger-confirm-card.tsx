"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  type FormEvent,
} from "react";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";

import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

type DangerConfirmAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

type UseDomainTableDangerConfirmCardStateParams = {
  action: DashboardPageCustomAction;
  serverAction: DangerConfirmAction;
};

/**
 * Encapsulates confirm-gated submit and server action state for one danger-confirm action.
 *
 * @param params - Action metadata and server action.
 * @returns State and handlers for the confirm card UI.
 */
const useDomainTableDangerConfirmCardState = ({
  action,
  serverAction,
}: UseDomainTableDangerConfirmCardStateParams) => {
  const [state, formAction, isPending] = useActionState(serverAction, {
    status: "idle",
  } satisfies DomainTableDangerConfirmState);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message =
        action.confirmMessage ?? "Are you sure? This action cannot be undone.";
      if (!confirm(message)) {
        return;
      }
      const formData = new FormData();
      formData.set("__actionId", action.id);
      startTransition(() => {
        formAction(formData);
      });
    },
    [action.confirmMessage, action.id, formAction],
  );

  return { state, handleSubmit, isPending };
};

export type DomainTableDangerConfirmCardProps = {
  action: DashboardPageCustomAction;
  serverAction: DangerConfirmAction;
};

/**
 * Renders a destructive custom action with a browser confirm dialog before POST.
 *
 * @param props - Custom action metadata and shared server action.
 * @returns Confirm button form for the given action.
 */
export const DomainTableDangerConfirmCard = ({
  action,
  serverAction,
}: DomainTableDangerConfirmCardProps) => {
  const { state, handleSubmit, isPending } =
    useDomainTableDangerConfirmCardState({ action, serverAction });

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-lg flex-col gap-3 rounded-md border border-destructive/30 p-4"
      aria-labelledby={`custom-action-${action.id}`}
    >
      <div className="grid gap-1">
        <h3
          className="text-sm font-medium text-destructive"
          id={`custom-action-${action.id}`}
        >
          {action.label}
        </h3>
        {action.description ? (
          <p className="text-xs text-muted-foreground">{action.description}</p>
        ) : null}
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Deleted {state.deleted} relation{state.deleted === 1 ? "" : "s"}.
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Working…" : action.label}
      </Button>
    </form>
  );
};

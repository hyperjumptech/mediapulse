"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  type FormEvent,
} from "react";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

type DangerConfirmAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

type UseDomainTableDangerConfirmActionParams = {
  action: DashboardPageCustomAction;
  serverAction: DangerConfirmAction;
};

/**
 * Encapsulates confirm-gated submit and server action state for one danger-confirm action.
 *
 * @param params - Action metadata and server action.
 * @returns State and handlers for danger-confirm UI controls.
 */
export const useDomainTableDangerConfirmAction = ({
  action,
  serverAction,
}: UseDomainTableDangerConfirmActionParams) => {
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

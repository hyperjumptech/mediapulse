"use client";

import { useActionState, useMemo } from "react";
import { createFormWithAction } from "route-action-gen/lib/react";

import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

type DomainTableRowDeleteAction = (formData: FormData) => Promise<void>;

type DomainTableRowDeleteState = { status: boolean } | null;

export const useDomainTableRowDeleteAction = (
  deleteAction: DomainTableRowDeleteAction,
) => {
  const [state, formAction, pending] = useActionState(
    async (
      _previousState: DomainTableRowDeleteState,
      formData: FormData,
    ): Promise<DomainTableRowDeleteState> => {
      await deleteAction(formData);

      return { status: true };
    },
    null,
  );
  const FormWithAction = useMemo(
    () => createFormWithAction(formAction),
    [formAction],
  );
  const confirmDialog = useConfirmActionDialog(state);

  return { FormWithAction, pending, ...confirmDialog };
};

"use client";

import { useActionState, useEffect, useMemo } from "react";
import { createFormWithAction } from "route-action-gen/lib/react";
import { toast } from "sonner";

import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";
import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

type DangerConfirmAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

type UseDomainTableDangerConfirmActionParams = {
  serverAction: DangerConfirmAction;
};

const INITIAL_STATE: DomainTableDangerConfirmState = { status: "idle" };

const formatDeletedRowsMessage = (deleted: number) => {
  const noun = deleted === 1 ? "row" : "rows";

  return `Deleted ${deleted} ${noun}.`;
};

export const useDomainTableDangerConfirmAction = ({
  serverAction,
}: UseDomainTableDangerConfirmActionParams) => {
  const [state, formAction, isPending] = useActionState(
    serverAction,
    INITIAL_STATE,
  );
  const FormWithAction = useMemo(
    () => createFormWithAction(formAction),
    [formAction],
  );
  const confirmationState = useMemo(
    () => ({ status: state.status === "success" }),
    [state],
  );
  const { open, setOpen, requestConfirmation } =
    useConfirmActionDialog(confirmationState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(formatDeletedRowsMessage(state.deleted));
    }
  }, [state]);

  const errorMessage = state.status === "error" ? state.message : null;

  return {
    FormWithAction,
    isPending,
    open,
    setOpen,
    requestConfirmation,
    errorMessage,
  };
};

"use client";

import { Trash2 } from "lucide-react";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

import { useDomainTableDangerConfirmAction } from "./use-domain-table-danger-confirm-action";

const DEFAULT_CONFIRM_MESSAGE = "Are you sure? This action cannot be undone.";

type DangerConfirmAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

export type DomainTableDangerConfirmButtonProps = {
  action: DashboardPageCustomAction;
  serverAction: DangerConfirmAction;
};

export const DomainTableDangerConfirmButton = ({
  action,
  serverAction,
}: DomainTableDangerConfirmButtonProps) => {
  const {
    FormWithAction,
    isPending,
    open,
    setOpen,
    requestConfirmation,
    errorMessage,
  } = useDomainTableDangerConfirmAction({ serverAction });
  const confirmMessage = action.confirmMessage ?? DEFAULT_CONFIRM_MESSAGE;
  const hiddenFields = [{ name: "__actionId", value: action.id }];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
        disabled={isPending}
        onClick={requestConfirmation}
      >
        <Trash2 aria-hidden />
        {action.label}
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={`${action.label}?`}
        description={
          <>
            {confirmMessage}
            {errorMessage ? (
              <span role="alert" className="mt-2 block text-destructive">
                {errorMessage}
              </span>
            ) : null}
          </>
        }
        confirmLabel={action.label}
        pendingLabel="Working…"
        pending={isPending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

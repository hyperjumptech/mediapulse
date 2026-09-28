"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/api-keys/actions/revoke/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

export type ApiKeyRow = {
  id: string;
  label: string;
};

type ApiKeyRowActionsProps = {
  row: ApiKeyRow;
};

const useApiKeyRowRevokeActions = () => {
  const { FormWithAction, state, pending } = useFormAction();
  const confirmDialog = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === false && state.message) {
      toast.error(String(state.message));
    }
  }, [state]);

  return { FormWithAction, pending, ...confirmDialog };
};

export const ApiKeyRowActions = ({ row }: ApiKeyRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useApiKeyRowRevokeActions();
  const hiddenFields = [{ name: "body.id", value: row.id }];

  return (
    <>
      <RowActionsMenu label={`Actions for API key ${row.label}`}>
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={requestConfirmation}
        >
          Revoke
        </DropdownMenuItem>
      </RowActionsMenu>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Revoke API key?"
        description={
          <>
            Requests using{" "}
            <span className="font-medium text-foreground">{row.label}</span>{" "}
            will fail immediately. This cannot be undone.
          </>
        }
        confirmLabel="Revoke"
        pendingLabel="Revoking…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

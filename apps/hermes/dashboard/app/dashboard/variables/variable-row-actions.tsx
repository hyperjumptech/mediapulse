"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/variables/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";
import type { VariablesPageResult } from "@/lib/variables";

type VariableRow = VariablesPageResult["variables"][number];

type EditVariableHandler = (variable: VariableRow) => void;

type VariableRowActionsProps = {
  variable: VariableRow;
  variableLabel: string;
  onEdit?: EditVariableHandler;
};

const useVariableRowActions = () => {
  const { FormWithAction, state, pending } = useFormAction();
  const { open, setOpen, requestConfirmation } = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === false) {
      const message = state.message ? String(state.message) : "Delete failed";
      toast.error(message);
    }
  }, [state]);

  return { FormWithAction, pending, open, setOpen, requestConfirmation };
};

export const VariableRowActions = ({
  variable,
  variableLabel,
  onEdit,
}: VariableRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useVariableRowActions();
  const hiddenFields = [{ name: "body.id", value: variable.id }];

  return (
    <>
      <RowActionsMenu label={`Actions for variable ${variableLabel}`}>
        {onEdit ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(variable)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={requestConfirmation}
        >
          Delete
        </DropdownMenuItem>
      </RowActionsMenu>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete variable?"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-mono text-foreground">{variableLabel}</span>.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete variable"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

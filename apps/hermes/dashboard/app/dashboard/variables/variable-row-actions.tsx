"use client";

import { useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/variables/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for variable ${variableLabel}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEdit ? (
            <>
              <DropdownMenuItem onSelect={() => onEdit(variable)}>
                <Pencil />
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
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

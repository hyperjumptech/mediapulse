"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/schedules/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

type EditScheduleHandler = (scheduleId: string) => void;

type ScheduleRowActionsProps = {
  scheduleId: string;
  scheduleName: string;
  onEdit: EditScheduleHandler;
};

const useScheduleRowActions = () => {
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

export const ScheduleRowActions = ({
  scheduleId,
  scheduleName,
  onEdit,
}: ScheduleRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useScheduleRowActions();
  const hiddenFields = [{ name: "body.scheduleId", value: scheduleId }];

  return (
    <>
      <RowActionsMenu label={`Actions for schedule ${scheduleName}`}>
        <DropdownMenuItem onSelect={() => onEdit(scheduleId)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
        title="Delete schedule?"
        description={
          <>
            This deletes{" "}
            <span className="font-medium text-foreground">{scheduleName}</span>{" "}
            and its run history. This cannot be undone.
          </>
        }
        confirmLabel="Delete schedule"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

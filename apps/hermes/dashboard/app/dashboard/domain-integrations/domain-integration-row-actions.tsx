"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/domain-integrations/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

export type DomainIntegrationRow = {
  id: string;
  integrationId: string;
  name: string;
};

type DomainIntegrationRowActionsProps = {
  row: DomainIntegrationRow;
};

const useDomainIntegrationRowDeleteActions = () => {
  const { FormWithAction, state, pending } = useFormAction();
  const confirmDialog = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === false && state.message) {
      toast.error(String(state.message));
    }
  }, [state]);

  return { FormWithAction, pending, ...confirmDialog };
};

export const DomainIntegrationRowActions = ({
  row,
}: DomainIntegrationRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useDomainIntegrationRowDeleteActions();
  const hiddenFields = [{ name: "body.id", value: row.id }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for integration ${row.integrationId}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
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
        title="Delete domain integration?"
        description={
          <>
            This deletes{" "}
            <span className="font-mono text-foreground">
              {row.integrationId}
            </span>{" "}
            ({row.name}). You cannot delete it while pipelines still reference
            it.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

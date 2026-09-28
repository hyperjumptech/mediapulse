"use client";

import Link from "next/link";
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

import { useFormAction } from "@/app/dashboard/pipelines/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

type EditPipelineHandler = (pipelineId: string) => void;

type PipelineRowActionsProps = {
  pipelineId: string;
  pipelineName: string;
  onEdit?: EditPipelineHandler;
};

const usePipelineRowActions = () => {
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

export const PipelineRowActions = ({
  pipelineId,
  pipelineName,
  onEdit,
}: PipelineRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    usePipelineRowActions();
  const hiddenFields = [{ name: "body.pipelineId", value: pipelineId }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for pipeline ${pipelineName}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEdit ? (
            <DropdownMenuItem onSelect={() => onEdit(pipelineId)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/pipelines/${pipelineId}`}>
                <Pencil />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
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
        title="Delete pipeline?"
        description={
          <>
            This deletes{" "}
            <span className="font-medium text-foreground">{pipelineName}</span>{" "}
            with its steps and run history, along with every schedule and HTTP
            trigger that uses it. This cannot be undone.
          </>
        }
        confirmLabel="Delete pipeline"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

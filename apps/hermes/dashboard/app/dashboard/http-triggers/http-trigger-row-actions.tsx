"use client";

import { useCallback, useEffect } from "react";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/http-triggers/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";
import {
  buildHttpTriggerInvokeCurlCommand,
  type HttpTriggerInvokeMethod,
} from "@/lib/http-trigger-invoke-curl";

type EditHttpTriggerHandler = (httpTriggerId: string) => void;

type HttpTriggerRowActionsProps = {
  httpTriggerId: string;
  httpTriggerName: string;
  method: HttpTriggerInvokeMethod;
  onEdit: EditHttpTriggerHandler;
};

const useHttpTriggerRowActions = (
  httpTriggerId: string,
  method: HttpTriggerInvokeMethod,
) => {
  const { FormWithAction, state, pending } = useFormAction();
  const { open, setOpen, requestConfirmation } = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === false) {
      const message = state.message ? String(state.message) : "Delete failed";
      toast.error(message);
    }
  }, [state]);

  const copyCurlCommand = useCallback(async () => {
    const command = buildHttpTriggerInvokeCurlCommand({
      method,
      triggerId: httpTriggerId,
      origin: window.location.origin,
    });
    try {
      await navigator.clipboard.writeText(command);
      toast.success("cURL command copied");
    } catch {
      toast.error("Couldn't copy the cURL command");
    }
  }, [httpTriggerId, method]);

  return {
    FormWithAction,
    pending,
    open,
    setOpen,
    requestConfirmation,
    copyCurlCommand,
  };
};

export const HttpTriggerRowActions = ({
  httpTriggerId,
  httpTriggerName,
  method,
  onEdit,
}: HttpTriggerRowActionsProps) => {
  const {
    FormWithAction,
    pending,
    open,
    setOpen,
    requestConfirmation,
    copyCurlCommand,
  } = useHttpTriggerRowActions(httpTriggerId, method);
  const hiddenFields = [{ name: "body.httpTriggerId", value: httpTriggerId }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for HTTP trigger ${httpTriggerName}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => onEdit(httpTriggerId)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyCurlCommand()}>
            <Copy />
            Copy cURL
          </DropdownMenuItem>
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
        title="Delete HTTP trigger?"
        description={
          <>
            This deletes{" "}
            <span className="font-medium text-foreground">
              {httpTriggerName}
            </span>{" "}
            and its run history. Callers using its endpoint will get errors.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete HTTP trigger"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

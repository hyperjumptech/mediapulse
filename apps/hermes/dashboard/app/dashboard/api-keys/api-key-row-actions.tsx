"use client";

import { Ban, MoreHorizontal } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/api-keys/actions/revoke/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for API key ${row.label}`}
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
            <Ban />
            Revoke
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

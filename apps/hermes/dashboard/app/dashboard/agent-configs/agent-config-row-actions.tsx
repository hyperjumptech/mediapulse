"use client";

import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

export type AgentConfigRow = {
  id: string;
  name: string;
  description: string | null;
  agentId: string;
  agentVersion: string;
  config: unknown;
  configSchemaFingerprint: string | null;
  createdAt: Date;
  createdBy: { name: string; email: string } | null;
  schemaValid: boolean;
};

type AgentConfigRowActionsProps = {
  config: AgentConfigRow;
  configLabel: string;
};

const useAgentConfigRowActions = () => {
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

export const AgentConfigRowActions = ({
  config,
  configLabel,
}: AgentConfigRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useAgentConfigRowActions();
  const hiddenFields = [{ name: "body.id", value: config.id }];

  return (
    <>
      <RowActionsMenu label={`Actions for config ${configLabel}`}>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/agent-configs/${config.id}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/agent-configs/new?duplicate=${config.id}`}>
            Duplicate
          </Link>
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
        title="Delete config?"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{configLabel}</span>.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete config"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

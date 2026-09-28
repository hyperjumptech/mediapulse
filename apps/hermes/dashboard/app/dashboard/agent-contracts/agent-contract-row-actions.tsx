"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/agent-contracts/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";

export type AgentContractRow = {
  id: string;
  name: string;
  description: string | null;
  brief: string;
  version: string;
  createdAt: Date;
  createdBy: { name: string; email: string } | null;
};

type EditContractHandler = (contract: AgentContractRow) => void;

type AgentContractRowActionsProps = {
  contract: AgentContractRow;
  onEdit: EditContractHandler;
};

const useAgentContractRowActions = () => {
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

export const AgentContractRowActions = ({
  contract,
  onEdit,
}: AgentContractRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useAgentContractRowActions();
  const hiddenFields = [{ name: "body.id", value: contract.id }];

  return (
    <>
      <RowActionsMenu label={`Actions for contract ${contract.name}`}>
        <DropdownMenuItem onSelect={() => onEdit(contract)}>
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
        title="Delete contract?"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{contract.name}</span>
            . This cannot be undone.
          </>
        }
        confirmLabel="Delete contract"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

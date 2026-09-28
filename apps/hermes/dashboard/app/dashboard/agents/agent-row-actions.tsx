"use client";

import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction } from "@/app/dashboard/agents/actions/delete/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";
import type { AgentsPageResult } from "@/lib/agents";

type AgentRow = AgentsPageResult["agents"][number];

type ViewAgentHandler = (agent: AgentRow) => void;

type AgentRowActionsProps = {
  agent: AgentRow;
  agentLabel: string;
  onView?: ViewAgentHandler;
};

const useAgentRowActions = () => {
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

export const AgentRowActions = ({
  agent,
  agentLabel,
  onView,
}: AgentRowActionsProps) => {
  const { FormWithAction, pending, open, setOpen, requestConfirmation } =
    useAgentRowActions();
  const hiddenFields = [{ name: "body.id", value: agent.id }];

  return (
    <>
      <RowActionsMenu label={`Actions for agent ${agentLabel}`}>
        {onView ? (
          <DropdownMenuItem onSelect={() => onView(agent)}>
            View details
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/agents/${agent.id}`}>View details</Link>
          </DropdownMenuItem>
        )}
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
        title="Delete agent?"
        description={
          <>
            This removes{" "}
            <span className="font-mono text-foreground">{agentLabel}</span> from
            the registry. This cannot be undone.
          </>
        }
        confirmLabel="Delete agent"
        pendingLabel="Deleting…"
        pending={pending}
        FormWithAction={FormWithAction}
        hiddenFields={hiddenFields}
      />
    </>
  );
};

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Eye, MoreHorizontal } from "lucide-react";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/agents/actions/delete/.generated/use-form-action";
import type { AgentsPageResult } from "@/lib/agents";

type AgentRow = AgentsPageResult["agents"][number];

type AgentRowActionsProps = {
  agent: AgentRow;
  agentLabel: string;
  /** When provided, View details opens the details modal via this callback instead of navigating. */
  onView?: (agent: AgentRow) => void;
};

/**
 * Dropdown actions for an agent row: View details, Delete.
 */
export const AgentRowActions = ({
  agent,
  agentLabel,
  onView,
}: AgentRowActionsProps) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Open menu"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onView ? (
          <DropdownMenuItem onSelect={() => onView(agent)}>
            <Eye className="mr-2 size-4" />
            View details
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <a href={`/dashboard/agents/${agent.id}`}>
              <Eye className="mr-2 size-4" />
              View details
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete agent "${agentLabel}"? This cannot be undone.`}
            bodyField={{ name: "body.id", value: agent.id }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

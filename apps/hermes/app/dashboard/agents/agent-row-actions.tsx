"use client";

import Link from "next/link";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { useFormAction } from "@/app/dashboard/agents/actions/delete/.generated/use-form-action";

/**
 * Dropdown actions for an agent row: Edit, Delete.
 */
export const AgentRowActions = ({
  agentId,
  agentLabel,
}: {
  agentId: string;
  agentLabel: string;
}) => {
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
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/agents/${agentId}`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(e) => {
            if (
              !confirm(`Delete agent "${agentLabel}"? This cannot be undone.`)
            ) {
              e.preventDefault();
            }
          }}
          asChild
        >
          <FormWithAction className="flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive [&_button]:flex [&_button]:w-full [&_button]:cursor-default [&_button]:items-center [&_button]:text-left">
            <input type="hidden" name="body.id" value={agentId} readOnly />
            <button type="submit" className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {pending ? "Deleting…" : "Delete"}
            </button>
          </FormWithAction>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

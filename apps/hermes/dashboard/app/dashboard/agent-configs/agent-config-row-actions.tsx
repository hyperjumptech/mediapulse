"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { useFormAction } from "@/app/dashboard/agent-configs/actions/delete/.generated/use-form-action";

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
  onEdit: (config: AgentConfigRow) => void;
  onDuplicate: (config: AgentConfigRow) => void;
};

/**
 * Encapsulates delete form action, error state, and refresh-on-success for agent config row actions.
 */
const useAgentConfigRowActions = (configLabel: string) => {
  const router = useRouter();
  const deleteFormWrapperRef = useRef<HTMLDivElement>(null);
  const { FormWithAction, state, pending } = useFormAction();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      setDeleteError(null);
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (state && state.status === false) {
      setDeleteError(errorMessage ?? "Delete failed");
    }
  }, [state, errorMessage]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const confirmed = confirm(
        `Delete config "${configLabel}"? This cannot be undone.`,
      );
      if (confirmed) {
        setDeleteError(null);
        const form = deleteFormWrapperRef.current?.querySelector("form");
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }
    },
    [configLabel],
  );

  return {
    FormWithAction,
    pending,
    deleteError,
    deleteFormWrapperRef,
    handleDeleteClick,
  };
};

/**
 * Dropdown actions for an agent config row: Edit, Duplicate, Delete.
 */
export const AgentConfigRowActions = ({
  config,
  configLabel,
  onEdit,
  onDuplicate,
}: AgentConfigRowActionsProps) => {
  const {
    FormWithAction,
    pending,
    deleteError,
    deleteFormWrapperRef,
    handleDeleteClick,
  } = useAgentConfigRowActions(configLabel);

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => onEdit(config)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate(config)}>
            <Copy className="mr-2 size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={pending} asChild>
            <div
              ref={deleteFormWrapperRef}
              className="flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-destructive/10 focus:text-destructive"
            >
              <FormWithAction className="flex w-full [&_button]:flex [&_button]:w-full [&_button]:cursor-default [&_button]:items-center [&_button]:text-left [&_button]:gap-2">
                <input
                  type="hidden"
                  name="body.id"
                  value={config.id}
                  readOnly
                />
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="size-4" />
                  {pending ? "Deleting…" : "Delete"}
                </button>
              </FormWithAction>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleteError ? (
        <p className="text-destructive text-sm mt-1" role="alert">
          {deleteError}
        </p>
      ) : null}
    </>
  );
};

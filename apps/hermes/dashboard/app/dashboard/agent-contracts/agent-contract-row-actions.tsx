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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { useFormAction } from "@/app/dashboard/agent-contracts/actions/delete/.generated/use-form-action";

export type AgentContractRow = {
  id: string;
  name: string;
  description: string | null;
  brief: string;
  version: string;
  createdAt: Date;
  createdBy: { name: string; email: string } | null;
};

type AgentContractRowActionsProps = {
  contract: AgentContractRow;
  onEdit: (contract: AgentContractRow) => void;
};

const useAgentContractRowActions = (contractName: string) => {
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
        `Delete contract "${contractName}"? This cannot be undone.`,
      );
      if (confirmed) {
        setDeleteError(null);
        const form = deleteFormWrapperRef.current?.querySelector("form");
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }
    },
    [contractName],
  );

  return {
    FormWithAction,
    pending,
    deleteError,
    deleteFormWrapperRef,
    handleDeleteClick,
  };
};

export const AgentContractRowActions = ({
  contract,
  onEdit,
}: AgentContractRowActionsProps) => {
  const {
    FormWithAction,
    pending,
    deleteError,
    deleteFormWrapperRef,
    handleDeleteClick,
  } = useAgentContractRowActions(contract.name);

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
          <DropdownMenuItem onSelect={() => onEdit(contract)}>
            <Pencil className="mr-2 size-4" />
            Edit
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
                  value={contract.id}
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

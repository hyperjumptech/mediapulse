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
import { MoreHorizontal, Pencil } from "lucide-react";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/variables/actions/delete/.generated/use-form-action";
import type { VariablesPageResult } from "@/lib/variables";

type VariableRow = VariablesPageResult["variables"][number];

type VariableRowActionsProps = {
  variable: VariableRow;
  variableLabel: string;
  /** When provided, Edit opens the edit modal via this callback instead of navigating. */
  onEdit?: (variable: VariableRow) => void;
};

/**
 * Dropdown actions for a variable row: Edit, Delete.
 */
export const VariableRowActions = ({
  variable,
  variableLabel,
  onEdit,
}: VariableRowActionsProps) => {
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
        {onEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(variable)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete variable "${variableLabel}"? This cannot be undone.`}
            bodyField={{ name: "body.id", value: variable.id }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

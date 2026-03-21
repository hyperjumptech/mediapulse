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
import { useFormAction } from "@/app/dashboard/relation-types/actions/delete/.generated/use-form-action";

/**
 * Encapsulates delete form action and refresh-on-success for relation type row actions.
 */
const useRelationTypeRowActions = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  const errorMessage =
    state && state.status === false ? (state.message as string) : null;

  return { FormWithAction, pending, errorMessage };
};

/**
 * Dropdown actions for a relation type row: Edit and Delete.
 */
export const RelationTypeRowActions = ({
  relationTypeId,
  relationTypeName,
  onEditClick,
}: {
  relationTypeId: string;
  relationTypeName: string;
  onEditClick?: (id: string) => void;
}) => {
  const { FormWithAction, pending, errorMessage } = useRelationTypeRowActions();

  return (
    <div className="flex items-center justify-end gap-2">
      {errorMessage ? (
        <span className="text-xs text-destructive" role="alert">
          {errorMessage}
        </span>
      ) : null}
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
          <DropdownMenuItem
            onSelect={() => onEditClick?.(relationTypeId)}
            disabled={!onEditClick}
          >
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={pending} asChild>
            <DeleteConfirmForm
              FormWithAction={FormWithAction}
              confirmMessage={`Delete relation type "${relationTypeName}"? This cannot be undone.`}
              bodyField={{ name: "body.relationTypeId", value: relationTypeId }}
              pending={pending}
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

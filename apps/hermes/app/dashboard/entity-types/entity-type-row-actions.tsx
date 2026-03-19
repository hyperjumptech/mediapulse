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
import { useFormAction } from "@/app/dashboard/entity-types/actions/delete/.generated/use-form-action";

/**
 * Encapsulates delete form action and refresh-on-success for entity type row actions.
 */
const useEntityTypeRowActions = () => {
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
 * Dropdown actions for an entity type row: Edit and Delete.
 */
export const EntityTypeRowActions = ({
  entityTypeId,
  entityTypeName,
  onEditClick,
}: {
  entityTypeId: string;
  entityTypeName: string;
  onEditClick?: (id: string) => void;
}) => {
  const { FormWithAction, pending, errorMessage } = useEntityTypeRowActions();

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
            onSelect={() => onEditClick?.(entityTypeId)}
            disabled={!onEditClick}
          >
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={pending} asChild>
            <DeleteConfirmForm
              FormWithAction={FormWithAction}
              confirmMessage={`Delete entity type "${entityTypeName}"? This cannot be undone.`}
              bodyField={{ name: "body.entityTypeId", value: entityTypeId }}
              pending={pending}
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

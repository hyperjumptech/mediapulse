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
import { useFormAction } from "@/app/dashboard/api-keys/actions/delete/.generated/use-form-action";
import type { ApiKeysPageResult } from "@/lib/api-keys";

type ApiKeyRow = ApiKeysPageResult["apiKeys"][number];

type ApiKeyRowActionsProps = {
  apiKey: ApiKeyRow;
  apiKeyLabel: string;
  /** When provided, Edit opens the edit modal via this callback instead of navigating. */
  onEdit?: (apiKey: ApiKeyRow) => void;
};

/**
 * Encapsulates delete form action and refresh-on-success for API key row actions.
 */
const useApiKeyRowActions = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  return { FormWithAction, pending };
};

/**
 * Dropdown actions for an API key row: Edit, Delete.
 */
export const ApiKeyRowActions = ({
  apiKey,
  apiKeyLabel,
  onEdit,
}: ApiKeyRowActionsProps) => {
  const { FormWithAction, pending } = useApiKeyRowActions();

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
          <DropdownMenuItem onSelect={() => onEdit(apiKey)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete API key "${apiKeyLabel}"? This cannot be undone.`}
            bodyField={{ name: "body.id", value: apiKey.id }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

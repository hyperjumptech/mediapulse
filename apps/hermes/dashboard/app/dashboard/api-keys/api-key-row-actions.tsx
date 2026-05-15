"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/api-keys/actions/revoke/.generated/use-form-action";

export type ApiKeyRow = {
  id: string;
  label: string;
};

type ApiKeyRowActionsProps = {
  row: ApiKeyRow;
};

/**
 * Wires revoke form action: refresh on success, toast server errors.
 */
const useApiKeyRowRevokeActions = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (state && state.status === false && state.message) {
      toast.error(String(state.message));
    }
  }, [state]);

  return { FormWithAction, pending };
};

/**
 * Dropdown with revoke for an MCP API key row.
 */
export const ApiKeyRowActions = ({ row }: ApiKeyRowActionsProps) => {
  const { FormWithAction, pending } = useApiKeyRowRevokeActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for API key ${row.label}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          asChild
          onSelect={(event) => {
            event.preventDefault();
          }}
        >
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Revoke API key "${row.label}"? Requests using this key will fail immediately.`}
            bodyField={{ name: "body.id", value: row.id }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

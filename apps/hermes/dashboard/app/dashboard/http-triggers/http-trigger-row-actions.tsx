"use client";

import { useCallback, useEffect } from "react";
import { buildHttpTriggerInvokeCurlCommand } from "@/lib/http-trigger-invoke-curl";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/http-triggers/actions/delete/.generated/use-form-action";

const useHttpTriggerRowActions = () => {
  const router = useRouter();
  const { FormWithAction, pending, state } = useFormAction();
  useEffect(() => {
    if (state && state.status === true) {
      router.refresh();
    }
  }, [router, state]);
  return { FormWithAction, pending };
};

/**
 * Dropdown row actions for one HTTP trigger.
 */
export const HttpTriggerRowActions = ({
  httpTriggerId,
  httpTriggerName,
  method,
  onEdit,
}: {
  httpTriggerId: string;
  httpTriggerName: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  onEdit: (httpTriggerId: string) => void;
}) => {
  const { FormWithAction, pending } = useHttpTriggerRowActions();
  const onCopyCurl = useCallback(async () => {
    const command = buildHttpTriggerInvokeCurlCommand({
      method,
      triggerId: httpTriggerId,
      origin: window.location.origin,
    });
    try {
      await navigator.clipboard.writeText(command);
      window.alert("cURL command copied to clipboard.");
    } catch {
      window.alert("Failed to copy cURL command.");
    }
  }, [httpTriggerId, method]);

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
        <DropdownMenuItem onSelect={() => onEdit(httpTriggerId)}>
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onCopyCurl()}>
          <Copy className="mr-2 size-4" />
          Copy cURL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete HTTP trigger "${httpTriggerName}"? This cannot be undone.`}
            bodyField={{ name: "body.httpTriggerId", value: httpTriggerId }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

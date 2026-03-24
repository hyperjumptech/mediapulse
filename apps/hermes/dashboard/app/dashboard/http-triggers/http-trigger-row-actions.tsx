"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil } from "lucide-react";

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
  onEdit,
}: {
  httpTriggerId: string;
  httpTriggerName: string;
  onEdit: (httpTriggerId: string) => void;
}) => {
  const { FormWithAction, pending } = useHttpTriggerRowActions();
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

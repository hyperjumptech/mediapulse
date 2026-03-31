"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { MoreHorizontal } from "lucide-react";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/domain-integrations/actions/delete/.generated/use-form-action";

export type DomainIntegrationRow = {
  id: string;
  integrationId: string;
  name: string;
};

type DomainIntegrationRowActionsProps = {
  row: DomainIntegrationRow;
};

/**
 * Dropdown with delete for a domain integration row; refreshes the page on success.
 */
export const DomainIntegrationRowActions = ({
  row,
}: DomainIntegrationRowActionsProps) => {
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
          aria-label={`Actions for integration ${row.integrationId}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete domain integration "${row.integrationId}" (${row.name})? You cannot delete it while pipelines still reference it.`}
            bodyField={{ name: "body.id", value: row.id }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

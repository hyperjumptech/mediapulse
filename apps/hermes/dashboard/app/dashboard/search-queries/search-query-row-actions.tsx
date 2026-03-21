"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction } from "@/app/dashboard/search-queries/actions/delete/.generated/use-form-action";

/**
 * Encapsulates delete form action and refresh-on-success for search-query row actions.
 */
const useSearchQueryRowActions = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  useEffect(() => {
    if (state?.status === true) {
      router.refresh();
    }
  }, [router, state]);

  return { FormWithAction, pending };
};

/**
 * Dropdown actions for a search-query row: Delete.
 */
export const SearchQueryRowActions = ({
  searchQueryId,
  keywords,
}: {
  searchQueryId: string;
  keywords: string;
}) => {
  const { FormWithAction, pending } = useSearchQueryRowActions();

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
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete query "${keywords}"? This cannot be undone.`}
            bodyField={{ name: "body.searchQueryId", value: searchQueryId }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

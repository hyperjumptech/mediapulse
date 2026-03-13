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
import { useFormAction } from "@/app/dashboard/tickers/actions/delete/.generated/use-form-action";

/**
 * Dropdown actions for a ticker row: Edit (opens modal), Delete.
 */
export const TickerRowActions = ({
  tickerId,
  tickerSymbol,
  onEditClick,
}: {
  tickerId: string;
  tickerSymbol: string;
  /** Called when Edit is chosen; use to open the edit modal. */
  onEditClick?: (id: string) => void;
}) => {
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
        <DropdownMenuItem
          onSelect={() => onEditClick?.(tickerId)}
          disabled={!onEditClick}
        >
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete ticker "${tickerSymbol}"? This cannot be undone.`}
            bodyField={{ name: "body.tickerId", value: tickerId }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

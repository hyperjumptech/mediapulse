"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";

import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { useHermesExecutionCancelButton } from "@/hooks/use-hermes-execution-cancel-button";
import {
  executionCancelTarget,
  executionDetailHref,
  type ExecutionListRow,
} from "@/lib/execution-list";

export const ExecutionRowActions = ({ row }: { row: ExecutionListRow }) => {
  const router = useRouter();
  const { isLoading, canCancel, requestCancel } =
    useHermesExecutionCancelButton(
      executionCancelTarget(row),
      row.runStatus,
      () => router.refresh(),
    );

  return (
    <RowActionsMenu label="Execution actions">
      <DropdownMenuItem asChild>
        <Link href={executionDetailHref(row)}>Open execution</Link>
      </DropdownMenuItem>
      {canCancel ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isLoading}
            onSelect={requestCancel}
          >
            {isLoading ? "Cancelling…" : "Cancel run"}
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActionsMenu>
  );
};

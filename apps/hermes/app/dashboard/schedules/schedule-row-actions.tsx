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
import { useFormAction } from "@/app/dashboard/schedules/actions/delete/.generated/use-form-action";

/**
 * Encapsulates delete form action and refresh-on-success for schedule row actions.
 */
const useScheduleRowActions = () => {
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
 * Dropdown actions for a schedule row: Edit (opens modal), Delete.
 */
export const ScheduleRowActions = ({
  scheduleId,
  scheduleName,
  onEdit,
}: {
  scheduleId: string;
  scheduleName: string;
  onEdit: (scheduleId: string) => void;
}) => {
  const { FormWithAction, pending } = useScheduleRowActions();

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
        <DropdownMenuItem onSelect={() => onEdit(scheduleId)}>
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete schedule "${scheduleName}"? This cannot be undone.`}
            bodyField={{ name: "body.scheduleId", value: scheduleId }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

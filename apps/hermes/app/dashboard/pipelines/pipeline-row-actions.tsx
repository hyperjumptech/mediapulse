"use client";

import Link from "next/link";
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
import { useFormAction } from "@/app/dashboard/pipelines/actions/delete/.generated/use-form-action";

/**
 * Encapsulates delete form action and refresh-on-success for pipeline row actions.
 */
const usePipelineRowActions = () => {
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
 * Dropdown actions for a pipeline row: Edit (modal or link to detail), Delete.
 */
export const PipelineRowActions = ({
  pipelineId,
  pipelineName,
  onEdit,
}: {
  pipelineId: string;
  pipelineName: string;
  onEdit?: (pipelineId: string) => void;
}) => {
  const { FormWithAction, pending } = usePipelineRowActions();

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
          <DropdownMenuItem onSelect={() => onEdit(pipelineId)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/pipelines/${pipelineId}`}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} asChild>
          <DeleteConfirmForm
            FormWithAction={FormWithAction}
            confirmMessage={`Delete pipeline "${pipelineName}"? This cannot be undone.`}
            bodyField={{ name: "body.pipelineId", value: pipelineId }}
            pending={pending}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

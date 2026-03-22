"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { KeyRound, MoreHorizontal, Power, PowerOff } from "lucide-react";

import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { useFormAction as useDeleteFormAction } from "@/app/dashboard/admins/actions/delete/.generated/use-form-action";
import { useFormAction as useSetActiveFormAction } from "@/app/dashboard/admins/actions/set-active/.generated/use-form-action";
import type { HermesAdminListRow } from "@/lib/hermes-admins-page";

import { ResetAdminPasswordDialog } from "./reset-admin-password-dialog";

const DROPDOWN_FORM_CLASS =
  "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent [&_button]:flex [&_button]:w-full [&_button]:cursor-default [&_button]:items-center [&_button]:text-left";

type AdminRowActionsProps = {
  admin: HermesAdminListRow;
  currentUserId: string;
};

/**
 * Refresh router when a row mutation succeeds (delete or enable/disable).
 */
const useRefreshOnMutationSuccess = (
  deleteState: { status?: boolean } | null,
  setActiveState: { status?: boolean } | null,
) => {
  const router = useRouter();

  useEffect(() => {
    if (deleteState?.status === true || setActiveState?.status === true) {
      router.refresh();
    }
  }, [deleteState, router, setActiveState]);
};

/**
 * Row actions: reset password, enable/disable, delete.
 */
export const AdminRowActions = ({
  admin,
  currentUserId,
}: AdminRowActionsProps) => {
  const [resetOpen, setResetOpen] = useState(false);
  const deleteAction = useDeleteFormAction();
  const setActiveAction = useSetActiveFormAction();

  useRefreshOnMutationSuccess(deleteAction.state, setActiveAction.state);

  const { FormWithAction: DeleteForm, pending: deletePending } = deleteAction;
  const { FormWithAction: SetActiveForm, pending: setActivePending } =
    setActiveAction;

  const isSelf = admin.id === currentUserId;
  const disableDelete = isSelf || deletePending || setActivePending;
  const disableMutation = setActivePending || deletePending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Open admin row menu"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound className="mr-2 size-4" />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {admin.isActive ? (
            <DropdownMenuItem disabled={disableMutation || isSelf} asChild>
              <SetActiveForm className={DROPDOWN_FORM_CLASS}>
                <input type="hidden" name="body.id" value={admin.id} readOnly />
                <input
                  type="hidden"
                  name="body.active"
                  value="false"
                  readOnly
                />
                <button type="submit" className="flex items-center gap-2">
                  <PowerOff className="size-4" />
                  {setActivePending ? "Updating…" : "Disable"}
                </button>
              </SetActiveForm>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={disableMutation} asChild>
              <SetActiveForm className={DROPDOWN_FORM_CLASS}>
                <input type="hidden" name="body.id" value={admin.id} readOnly />
                <input type="hidden" name="body.active" value="true" readOnly />
                <button type="submit" className="flex items-center gap-2">
                  <Power className="size-4" />
                  {setActivePending ? "Updating…" : "Enable"}
                </button>
              </SetActiveForm>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={disableDelete}
            asChild
          >
            <DeleteConfirmForm
              FormWithAction={DeleteForm}
              confirmMessage={`Delete admin "${admin.email}"? This cannot be undone.`}
              bodyField={{ name: "body.id", value: admin.id }}
              pending={deletePending}
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResetAdminPasswordDialog
        admin={admin}
        open={resetOpen}
        onOpenChange={setResetOpen}
      />
    </>
  );
};

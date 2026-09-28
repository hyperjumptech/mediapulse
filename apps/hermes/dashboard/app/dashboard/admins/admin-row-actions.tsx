"use client";

import {
  KeyRound,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { useFormAction as useDeleteFormAction } from "@/app/dashboard/admins/actions/delete/.generated/use-form-action";
import { useFormAction as useSetActiveFormAction } from "@/app/dashboard/admins/actions/set-active/.generated/use-form-action";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useConfirmActionDialog } from "@/hooks/use-confirm-action-dialog";
import type { HermesAdminListRow } from "@/lib/hermes-admins-page";

import { ResetAdminPasswordDialog } from "./reset-admin-password-dialog";

const MENU_FORM_BUTTON_CLASS =
  "flex w-full cursor-default items-center gap-2 text-left";

type AdminRowActionsProps = {
  admin: HermesAdminListRow;
  currentUserId: string;
};

const useResetPasswordDialogState = () => {
  const [resetOpen, setResetOpen] = useState(false);

  return { resetOpen, setResetOpen };
};

const useAdminDeleteAction = () => {
  const { FormWithAction, state, pending } = useDeleteFormAction();
  const confirmDialog = useConfirmActionDialog(state);

  useEffect(() => {
    if (state && state.status === false && state.message) {
      toast.error(String(state.message));
    }
  }, [state]);

  return { FormWithAction, pending, ...confirmDialog };
};

export const AdminRowActions = ({
  admin,
  currentUserId,
}: AdminRowActionsProps) => {
  const { resetOpen, setResetOpen } = useResetPasswordDialogState();
  const deleteAction = useAdminDeleteAction();
  const setActiveAction = useSetActiveFormAction();

  const { FormWithAction: SetActiveForm, pending: setActivePending } =
    setActiveAction;

  const isSelf = admin.id === currentUserId;
  const disableDelete = isSelf || deleteAction.pending || setActivePending;
  const disableMutation = setActivePending || deleteAction.pending;
  const deleteHiddenFields = [{ name: "body.id", value: admin.id }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
            aria-label={`Actions for admin ${admin.email}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          {admin.isActive ? (
            <DropdownMenuItem disabled={disableMutation || isSelf} asChild>
              <SetActiveForm>
                <input type="hidden" name="body.id" value={admin.id} readOnly />
                <input
                  type="hidden"
                  name="body.active"
                  value="false"
                  readOnly
                />
                <button type="submit" className={MENU_FORM_BUTTON_CLASS}>
                  <PowerOff />
                  {setActivePending ? "Updating…" : "Disable"}
                </button>
              </SetActiveForm>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={disableMutation} asChild>
              <SetActiveForm>
                <input type="hidden" name="body.id" value={admin.id} readOnly />
                <input type="hidden" name="body.active" value="true" readOnly />
                <button type="submit" className={MENU_FORM_BUTTON_CLASS}>
                  <Power />
                  {setActivePending ? "Updating…" : "Enable"}
                </button>
              </SetActiveForm>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={disableDelete}
            onSelect={deleteAction.requestConfirmation}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteAction.open}
        onOpenChange={deleteAction.setOpen}
        title="Delete admin?"
        description={
          <>
            <span className="font-medium text-foreground">{admin.email}</span>{" "}
            will lose access to the dashboard. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleteAction.pending}
        FormWithAction={deleteAction.FormWithAction}
        hiddenFields={deleteHiddenFields}
      />
      <ResetAdminPasswordDialog
        admin={admin}
        open={resetOpen}
        onOpenChange={setResetOpen}
      />
    </>
  );
};

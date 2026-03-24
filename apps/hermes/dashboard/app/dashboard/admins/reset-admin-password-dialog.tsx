"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/admins/actions/reset-password/.generated/use-form-action";
import type { HermesAdminListRow } from "@/lib/hermes-admins-page";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

type ResetAdminPasswordDialogProps = {
  admin: HermesAdminListRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog state, password confirmation, and reset-password form action with refresh on success.
 */
const useResetAdminPasswordDialogState = ({
  open,
  onOpenChange,
}: Pick<ResetAdminPasswordDialogProps, "open" | "onOpenChange">) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (nextState) => Boolean(nextState && nextState.status === true),
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });

  return {
    FormWithAction,
    pending,
    errorMessage,
  };
};

/**
 * Lets an admin set a new password for another admin row (or themselves).
 */
export const ResetAdminPasswordDialog = ({
  admin,
  open,
  onOpenChange,
}: ResetAdminPasswordDialogProps) => {
  const { FormWithAction, pending, errorMessage } =
    useResetAdminPasswordDialogState({ open, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <FormWithAction
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            const form = e.currentTarget;
            const pwd = (
              form.elements.namedItem("body.newPassword") as HTMLInputElement
            )?.value;
            const confirm = (
              form.elements.namedItem("confirmPassword") as HTMLInputElement
            )?.value;
            if (pwd !== confirm) {
              e.preventDefault();
              alert("Passwords do not match");
            }
          }}
        >
          <input type="hidden" name="body.id" value={admin.id} readOnly />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`new-password-${admin.id}`}>New password</Label>
            <Input
              id={`new-password-${admin.id}`}
              name="body.newPassword"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`confirm-password-${admin.id}`}>
              Confirm password
            </Label>
            <Input
              id={`confirm-password-${admin.id}`}
              name="confirmPassword"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save password"}
            </Button>
          </DialogFooter>
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};

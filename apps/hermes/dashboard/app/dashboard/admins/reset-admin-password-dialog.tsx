"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";

import { Dialog } from "@workspace/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useFormAction } from "@/app/dashboard/admins/actions/reset-password/.generated/use-form-action";
import type { HermesAdminListRow } from "@/lib/hermes-admins-page";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

type ResetAdminPasswordDialogProps = {
  admin: HermesAdminListRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const readFormFieldValue = (form: HTMLFormElement, fieldName: string) => {
  const field = form.elements.namedItem(fieldName);

  return field instanceof HTMLInputElement ? field.value : undefined;
};

/**
 * Dialog state, password confirmation, and reset-password form action with close on success.
 */
const useResetAdminPasswordDialogState = ({
  open,
  onOpenChange,
}: Pick<ResetAdminPasswordDialogProps, "open" | "onOpenChange">) => {
  const { FormWithAction, state, pending } = useFormAction();
  const [passwordMismatch, setPasswordMismatch] = useState(false);

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
    },
  });

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const newPassword = readFormFieldValue(form, "body.newPassword");
    const confirmPassword = readFormFieldValue(form, "confirmPassword");
    const passwordsMatch = newPassword === confirmPassword;

    setPasswordMismatch(!passwordsMatch);
    if (!passwordsMatch) {
      event.preventDefault();
    }
  }, []);

  const clearPasswordMismatch = useCallback(() => {
    setPasswordMismatch(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setPasswordMismatch(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return {
    FormWithAction,
    pending,
    errorMessage,
    passwordMismatch,
    handleSubmit,
    clearPasswordMismatch,
    handleOpenChange,
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
  const {
    FormWithAction,
    pending,
    errorMessage,
    passwordMismatch,
    handleSubmit,
    clearPasswordMismatch,
    handleOpenChange,
  } = useResetAdminPasswordDialogState({ open, onOpenChange });
  const newPasswordId = `new-password-${admin.id}`;
  const confirmPasswordId = `confirm-password-${admin.id}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogContent>
        <FormDialogHeader title="Reset password" />
        <FormWithAction
          className={formDialogFormClassName}
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="body.id" value={admin.id} readOnly />
          <FormDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={newPasswordId}>New password</FieldLabel>
                <Input
                  id={newPasswordId}
                  name="body.newPassword"
                  type="password"
                  required
                  minLength={4}
                  autoComplete="new-password"
                  onChange={clearPasswordMismatch}
                  disabled={pending}
                />
              </Field>
              <Field data-invalid={passwordMismatch || undefined}>
                <FieldLabel htmlFor={confirmPasswordId}>
                  Confirm password
                </FieldLabel>
                <Input
                  id={confirmPasswordId}
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={4}
                  autoComplete="new-password"
                  aria-invalid={passwordMismatch || undefined}
                  onChange={clearPasswordMismatch}
                  disabled={pending}
                />
                {passwordMismatch ? (
                  <FieldError>Passwords do not match</FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton
              onCancel={() => handleOpenChange(false)}
              disabled={pending}
            />
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Save password
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

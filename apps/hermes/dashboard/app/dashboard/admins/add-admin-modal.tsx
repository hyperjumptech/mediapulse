"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useFormAction } from "@/app/dashboard/admins/actions/create/.generated/use-form-action";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

type AddAdminModalProps = {
  trigger?: React.ReactNode;
};

/**
 * Owns add-admin dialog open state, form action wiring, and close after success.
 */
const useAddAdminModalState = () => {
  const [open, setOpen] = useState(false);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successId = useMemo(
    () =>
      state && state.status === true && state.data && "id" in state.data
        ? String((state.data as { id: string }).id)
        : null,
    [state],
  );

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successId != null && handledSuccessRef.current !== successId) {
      handledSuccessRef.current = successId;
      setOpen(false);
    }
  }, [successId]);

  return {
    open,
    setOpen,
    FormWithAction,
    pending,
    errorMessage,
  };
};

/**
 * Modal to create a new Hermes dashboard admin (email, name, initial password).
 */
export const AddAdminModal = ({ trigger }: AddAdminModalProps) => {
  const { open, setOpen, FormWithAction, pending, errorMessage } =
    useAddAdminModalState();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <FormDialogContent>
        <FormDialogHeader title="Add admin" />
        <FormWithAction className={formDialogFormClassName}>
          <FormDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="add-admin-name">Name</FieldLabel>
                <Input
                  id="add-admin-name"
                  name="body.name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="add-admin-email">Email</FieldLabel>
                <Input
                  id="add-admin-email"
                  name="body.email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="add-admin-password">
                  Initial password
                </FieldLabel>
                <Input
                  id="add-admin-password"
                  name="body.password"
                  type="password"
                  required
                  minLength={4}
                  autoComplete="new-password"
                  disabled={pending}
                />
              </Field>
            </FieldGroup>
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton
              onCancel={() => setOpen(false)}
              disabled={pending}
            />
            <SubmitButton pending={pending} pendingLabel="Creating…">
              Create admin
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

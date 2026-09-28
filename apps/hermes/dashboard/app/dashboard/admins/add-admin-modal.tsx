"use client";

import { Dialog } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

import { useAddAdminModalState } from "./use-add-admin-modal-state";

export const AddAdminModal = () => {
  const { open, setOpen, FormWithAction, pending, errorMessage } =
    useAddAdminModalState();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

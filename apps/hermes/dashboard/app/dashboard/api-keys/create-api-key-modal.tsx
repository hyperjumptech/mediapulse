"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FormBooleanCheckboxField } from "@/components/form-boolean-checkbox-field";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { OneTimeSecretReveal } from "@/components/one-time-secret-reveal";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useFormAction } from "@/app/dashboard/api-keys/actions/create/.generated/use-form-action";

type CreateApiKeyModalProps = {
  trigger?: React.ReactNode;
};

type CreateSuccessPayload = {
  id: string;
  label: string;
  readOnly: boolean;
  apiKeyPlaintext: string;
};

/**
 * Owns create-key dialog state and one-time secret display.
 */
const useCreateApiKeyModalState = () => {
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateSuccessPayload | null>(
    null,
  );
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successPayload = useMemo((): CreateSuccessPayload | null => {
    if (state?.status !== true || !state.data) {
      return null;
    }
    const data = state.data as CreateSuccessPayload;
    if (!data.apiKeyPlaintext) {
      return null;
    }
    return data;
  }, [state]);

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successPayload && handledSuccessRef.current !== successPayload.id) {
      handledSuccessRef.current = successPayload.id;
      setCreatedKey(successPayload);
    }
  }, [successPayload]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreatedKey(null);
      handledSuccessRef.current = null;
    }
  };

  return {
    open,
    handleOpenChange,
    FormWithAction,
    pending,
    errorMessage,
    createdKey,
  };
};

type CreateApiKeyFormFieldsProps = {
  pending: boolean;
};

const CreateApiKeyFormFields = ({ pending }: CreateApiKeyFormFieldsProps) => (
  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="mcp-key-label">Label</FieldLabel>
      <Input
        id="mcp-key-label"
        name="body.label"
        required
        disabled={pending}
        placeholder="e.g. Cursor prod read-only"
        autoComplete="off"
      />
    </Field>
    <FormBooleanCheckboxField
      id="mcp-key-read-only"
      name="body.readOnly"
      defaultChecked={false}
      checkedSubmitValue="true"
      disabled={pending}
      label="Read-only"
      description="No dashboard mutations via MCP."
    />
  </FieldGroup>
);

/**
 * Modal to create an MCP API key; shows the secret exactly once after success.
 */
export const CreateApiKeyModal = ({ trigger }: CreateApiKeyModalProps) => {
  const {
    open,
    handleOpenChange,
    FormWithAction,
    pending,
    errorMessage,
    createdKey,
  } = useCreateApiKeyModalState();
  const closeModal = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <FormDialogContent>
        <FormDialogHeader
          title={createdKey ? "Copy your API key" : "Create API key"}
        />
        {createdKey ? (
          <>
            <FormDialogBody>
              <OneTimeSecretReveal
                secret={createdKey.apiKeyPlaintext}
                secretLabel="API key"
              >
                Paste it into Cursor MCP secrets, not git.
              </OneTimeSecretReveal>
            </FormDialogBody>
            <FormDialogFooter>
              <Button type="button" onClick={closeModal}>
                Done
              </Button>
            </FormDialogFooter>
          </>
        ) : (
          <FormWithAction className={formDialogFormClassName}>
            <FormDialogBody>
              <CreateApiKeyFormFields pending={pending} />
            </FormDialogBody>
            <FormDialogFooter errorMessage={errorMessage}>
              <FormDialogCancelButton
                onCancel={closeModal}
                disabled={pending}
              />
              <SubmitButton pending={pending} pendingLabel="Creating…">
                Create key
              </SubmitButton>
            </FormDialogFooter>
          </FormWithAction>
        )}
      </FormDialogContent>
    </Dialog>
  );
};

"use client";

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
import { Dialog } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useCreateApiKeyModalState } from "./use-create-api-key-modal-state";

const CREATE_API_KEY_DESCRIPTION = "Each key acts as the admin who created it.";

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

export const CreateApiKeyModal = () => {
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
      <FormDialogContent hasDescription>
        <FormDialogHeader
          title={createdKey ? "Copy your API key" : "Create API key"}
          description={CREATE_API_KEY_DESCRIPTION}
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

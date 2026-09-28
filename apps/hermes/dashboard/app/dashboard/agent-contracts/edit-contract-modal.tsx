"use client";

import { Dialog } from "@workspace/ui/components/dialog";

import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

import {
  AgentContractFormContent,
  isAgentContractFormIncomplete,
} from "./agent-contract-form-fields";
import type { AgentContractRow } from "./agent-contract-row-actions";
import { useEditContractModalState } from "./use-edit-contract-modal-state";

type EditContractModalProps = {
  contract: AgentContractRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const EditContractModal = ({
  contract,
  open,
  onOpenChange,
}: EditContractModalProps) => {
  const { formState, setFormState, FormWithAction, pending, errorMessage } =
    useEditContractModalState(contract, open, onOpenChange);
  const isIncomplete = isAgentContractFormIncomplete(formState);

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent size="wide">
        <FormDialogHeader title={`Edit contract: ${contract.name}`} />
        <FormWithAction className={formDialogFormClassName}>
          <input type="hidden" name="body.id" value={contract.id} readOnly />
          <FormDialogBody>
            <AgentContractFormContent
              formState={formState}
              setFormState={setFormState}
              disabled={pending}
            />
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton
              onCancel={() => onOpenChange(false)}
              disabled={pending}
            />
            <SubmitButton
              pending={pending}
              pendingLabel="Saving…"
              disabled={isIncomplete}
            >
              Save changes
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

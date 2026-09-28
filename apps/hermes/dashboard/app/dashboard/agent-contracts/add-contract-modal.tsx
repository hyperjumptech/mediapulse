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
import { useAddContractModalState } from "./use-add-contract-modal-state";

type AddContractModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AddContractModal = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddContractModalProps) => {
  const {
    open,
    setOpen,
    formState,
    setFormState,
    FormWithAction,
    pending,
    errorMessage,
  } = useAddContractModalState(controlledOpen, controlledOnOpenChange);
  const isIncomplete = isAgentContractFormIncomplete(formState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <FormDialogContent size="wide">
        <FormDialogHeader title="Add contract" />
        <FormWithAction className={formDialogFormClassName}>
          <FormDialogBody>
            <AgentContractFormContent
              formState={formState}
              setFormState={setFormState}
              disabled={pending}
            />
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton
              onCancel={() => setOpen(false)}
              disabled={pending}
            />
            <SubmitButton
              pending={pending}
              pendingLabel="Creating…"
              disabled={isIncomplete}
            >
              Create contract
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

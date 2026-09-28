"use client";

import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";

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
  trigger?: React.ReactNode;
};

export const AddContractModal = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger = <Button>Add contract</Button>,
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
      {trigger != null ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
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

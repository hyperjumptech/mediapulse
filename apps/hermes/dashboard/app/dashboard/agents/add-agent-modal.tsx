"use client";

import { useMemo, useState } from "react";

import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { useFormAction } from "@/app/dashboard/agents/actions/create/.generated/use-form-action";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { SubmitButton } from "@/components/submit-button";

import { AgentFormFields } from "./agent-form-fields";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

/**
 * Encapsulates create-agent form state, modal open state, and close-on-success behavior.
 */
const useAddAgentModalState = () => {
  const [open, setOpen] = useState(false);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message as string;
    }
    return null;
  }, [state]);

  useCloseOnSuccessfulSubmit({
    open: true,
    pending,
    state,
    isSuccess: (nextState) =>
      Boolean(
        nextState && nextState.status === true && nextState.data?.id != null,
      ),
    onSuccess: () => {
      setOpen(false);
    },
  });

  return { open, setOpen, FormWithAction, pending, errorMessage };
};

/**
 * Modal with form to create a new agent. Submits via create action and closes on success.
 */
export const AddAgentModal = () => {
  const { open, setOpen, FormWithAction, pending, errorMessage } =
    useAddAgentModalState();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add agent</Button>
      </DialogTrigger>
      <FormDialogContent>
        <FormDialogHeader title="Add agent" />
        <FormWithAction className={formDialogFormClassName}>
          <FormDialogBody>
            <AgentFormFields mode="create" pending={pending} />
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            <FormDialogCancelButton
              onCancel={() => setOpen(false)}
              disabled={pending}
            />
            <SubmitButton pending={pending} pendingLabel="Creating…">
              Create agent
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      </FormDialogContent>
    </Dialog>
  );
};

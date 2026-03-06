"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { useFormAction } from "@/app/dashboard/agents/actions/create/.generated/use-form-action";

import { AgentFormFields } from "./agent-form-fields";

/**
 * Hook state for the create-agent form inside the modal.
 */
const useCreateAgentFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message as string;
    }
    return null;
  }, [state]);

  const success = useMemo(() => {
    return state && state.status === true && state.data?.id != null;
  }, [state]);

  return { FormWithAction, pending, errorMessage, success };
};

/**
 * Modal with form to create a new agent. Submits via create action; closes and refreshes on success.
 */
export const AddAgentModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { FormWithAction, pending, errorMessage, success } =
    useCreateAgentFormState();
  const didHandleSuccess = useRef(false);

  useEffect(() => {
    if (open) {
      didHandleSuccess.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (success && !didHandleSuccess.current) {
      didHandleSuccess.current = true;
      setOpen(false);
      router.refresh();
    }
  }, [success, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add agent</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
        </DialogHeader>
        <FormWithAction className="flex flex-col gap-4">
          <AgentFormFields
            mode="create"
            pending={pending}
            errorMessage={errorMessage}
            submitLabel={pending ? "Creating…" : "Create agent"}
          />
        </FormWithAction>
      </DialogContent>
    </Dialog>
  );
};

"use client";

import { useEffect, useMemo, useState } from "react";

import { useFormAction } from "@/app/dashboard/agent-contracts/actions/create/.generated/use-form-action";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";
import { useCreateRequestOpenState } from "@/hooks/use-create-request";

import type { AgentContractFormState } from "./agent-contract-form-fields";

type OpenChangeHandler = (open: boolean) => void;

const emptyForm: AgentContractFormState = {
  name: "",
  description: "",
  brief: "",
  version: "1.0",
};

export const useAddContractModalState = (
  controlledOpen?: boolean,
  onOpenChange?: OpenChangeHandler,
) => {
  const createRequest = useCreateRequestOpenState();
  const [formState, setFormState] = useState<AgentContractFormState>(emptyForm);
  const { FormWithAction, state, pending } = useFormAction();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : createRequest.open;
  const setOpen = useMemo(
    () => (isControlled ? (onOpenChange ?? (() => {})) : createRequest.setOpen),
    [isControlled, onOpenChange, createRequest.setOpen],
  );

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (open) {
      setFormState(emptyForm);
    }
  }, [open]);

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (nextState) =>
      Boolean(
        nextState && nextState.status === true && nextState.data?.id != null,
      ),
    onSuccess: () => {
      setOpen(false);
      setFormState(emptyForm);
    },
  });

  return {
    open,
    setOpen,
    formState,
    setFormState,
    FormWithAction,
    pending,
    errorMessage,
  };
};

"use client";

import { useEffect, useMemo, useState } from "react";

import { useFormAction } from "@/app/dashboard/agent-contracts/actions/update/.generated/use-form-action";
import { useCloseOnSuccessfulSubmit } from "@/app/dashboard/hooks/use-close-on-successful-submit";

import type { AgentContractFormState } from "./agent-contract-form-fields";
import type { AgentContractRow } from "./agent-contract-row-actions";

type OpenChangeHandler = (open: boolean) => void;

const initialFormState: AgentContractFormState = {
  name: "",
  description: "",
  brief: "",
  version: "",
};

export const useEditContractModalState = (
  contract: AgentContractRow | null,
  open: boolean,
  onOpenChange: OpenChangeHandler,
) => {
  const [formState, setFormState] =
    useState<AgentContractFormState>(initialFormState);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message as string;
    return null;
  }, [state]);

  useEffect(() => {
    if (contract && open) {
      setFormState({
        name: contract.name,
        description: contract.description ?? "",
        brief: contract.brief,
        version: contract.version,
      });
    }
  }, [contract, open]);

  useCloseOnSuccessfulSubmit({
    open,
    pending,
    state,
    isSuccess: (nextState) => Boolean(nextState && nextState.status === true),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return { formState, setFormState, FormWithAction, pending, errorMessage };
};

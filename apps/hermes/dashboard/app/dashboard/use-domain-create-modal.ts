"use client";

import { useCallback } from "react";

import { useCreateRequestOpenState } from "@/hooks/use-create-request";

type DomainCreateAction = (formData: FormData) => Promise<void>;

export const useDomainCreateModal = (createAction: DomainCreateAction) => {
  const { open, setOpen } = useCreateRequestOpenState();

  const submit = useCallback(
    async (formData: FormData) => {
      await createAction(formData);
      setOpen(false);
    },
    [createAction, setOpen],
  );

  return { open, setOpen, submit };
};

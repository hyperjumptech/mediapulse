"use client";

import { useEffect, useMemo, useRef } from "react";

import { useFormAction } from "@/app/dashboard/admins/actions/create/.generated/use-form-action";
import { useCreateRequestOpenState } from "@/hooks/use-create-request";

export const useAddAdminModalState = () => {
  const { open, setOpen } = useCreateRequestOpenState();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successId = useMemo(
    () =>
      state && state.status === true && state.data && "id" in state.data
        ? String((state.data as { id: string }).id)
        : null,
    [state],
  );

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successId != null && handledSuccessRef.current !== successId) {
      handledSuccessRef.current = successId;
      setOpen(false);
    }
  }, [successId, setOpen]);

  return {
    open,
    setOpen,
    FormWithAction,
    pending,
    errorMessage,
  };
};

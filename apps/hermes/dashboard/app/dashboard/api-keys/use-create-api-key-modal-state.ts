"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFormAction } from "@/app/dashboard/api-keys/actions/create/.generated/use-form-action";
import { useCreateRequestOpenState } from "@/hooks/use-create-request";

type CreatedApiKey = {
  id: string;
  label: string;
  readOnly: boolean;
  apiKeyPlaintext: string;
};

export const useCreateApiKeyModalState = () => {
  const { open, setOpen } = useCreateRequestOpenState();
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(
    () => (state && state.status === false ? String(state.message) : null),
    [state],
  );

  const successPayload = useMemo((): CreatedApiKey | null => {
    if (state?.status !== true || !state.data) {
      return null;
    }
    const data = state.data as CreatedApiKey;
    if (!data.apiKeyPlaintext) {
      return null;
    }

    return data;
  }, [state]);

  const handledSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (successPayload && handledSuccessRef.current !== successPayload.id) {
      handledSuccessRef.current = successPayload.id;
      setCreatedKey(successPayload);
    }
  }, [successPayload]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCreatedKey(null);
      handledSuccessRef.current = null;
    }
  };

  return {
    open,
    handleOpenChange,
    FormWithAction,
    pending,
    errorMessage,
    createdKey,
  };
};

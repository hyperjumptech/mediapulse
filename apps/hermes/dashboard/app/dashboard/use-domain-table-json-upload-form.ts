"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import type { DomainTableJsonImportState } from "@/lib/domain-dashboard";

import { readUploadedFileAsUtf8Text } from "./read-uploaded-file-as-utf8-text";

export type DomainTableJsonImportAction = (
  state: DomainTableJsonImportState,
  formData: FormData,
) => Promise<DomainTableJsonImportState>;

type UseDomainTableJsonUploadFormParams = {
  action: DashboardPageCustomAction;
  serverAction: DomainTableJsonImportAction;
};

const INITIAL_STATE: DomainTableJsonImportState = { status: "idle" };

const MISSING_FILE_MESSAGE = "Select a JSON file first.";

export const useDomainTableJsonUploadForm = ({
  action,
  serverAction,
}: UseDomainTableJsonUploadFormParams) => {
  const [state, formAction, isPending] = useActionState(
    serverAction,
    INITIAL_STATE,
  );
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFile(event.target.files?.[0] ?? null);
      setClientError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) {
        setClientError(MISSING_FILE_MESSAGE);

        return;
      }
      setClientError(null);
      const text = await readUploadedFileAsUtf8Text(file);
      const formData = new FormData();
      formData.set("__actionId", action.id);
      formData.set("payloadJson", text);
      startTransition(() => {
        formAction(formData);
      });
    },
    [action.id, file, formAction],
  );

  const errorMessage =
    clientError ?? (state.status === "error" ? state.message : null);

  return {
    state,
    file,
    errorMessage,
    handleFileChange,
    handleSubmit,
    isPending,
  };
};

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
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";

import type { DomainTableJsonImportState } from "@/lib/domain-dashboard";
import { readUploadedFileAsUtf8Text } from "@/app/dashboard/read-uploaded-file-as-utf8-text";

type JsonImportAction = (
  state: DomainTableJsonImportState,
  formData: FormData,
) => Promise<DomainTableJsonImportState>;

type UseDomainTableJsonUploadCardStateParams = {
  action: DashboardPageCustomAction;
  serverAction: JsonImportAction;
};

/**
 * Encapsulates file selection, submit handler, and server action state for one JSON upload action.
 *
 * @param params - Action metadata and server action.
 * @returns State and handlers for the upload card UI.
 */
const useDomainTableJsonUploadCardState = ({
  action,
  serverAction,
}: UseDomainTableJsonUploadCardStateParams) => {
  const [state, formAction, isPending] = useActionState(serverAction, {
    status: "idle",
  } satisfies DomainTableJsonImportState);
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
        setClientError("Select a JSON file first.");
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

  return {
    state,
    file,
    clientError,
    handleFileChange,
    handleSubmit,
    isPending,
  };
};

export type DomainTableJsonUploadCardProps = {
  action: DashboardPageCustomAction;
  serverAction: JsonImportAction;
};

/**
 * Renders a single manifest-driven JSON file upload (e.g. IDX ticker import).
 *
 * @param props - Custom action metadata and shared server action.
 * @returns Upload form for the given action.
 */
export const DomainTableJsonUploadCard = ({
  action,
  serverAction,
}: DomainTableJsonUploadCardProps) => {
  const {
    state,
    file,
    clientError,
    handleFileChange,
    handleSubmit,
    isPending,
  } = useDomainTableJsonUploadCardState({ action, serverAction });

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-lg flex-col gap-3 rounded-md border p-4"
      aria-labelledby={`custom-action-${action.id}`}
    >
      <div className="grid gap-1">
        <h3 className="text-sm font-medium" id={`custom-action-${action.id}`}>
          {action.label}
        </h3>
        {action.description ? (
          <p className="text-xs text-muted-foreground">{action.description}</p>
        ) : null}
      </div>
      <Input
        type="file"
        accept={action.accept ?? ".json,application/json"}
        onChange={handleFileChange}
        disabled={isPending}
        className="max-w-md"
      />
      {clientError ? (
        <p className="text-sm text-destructive" role="alert">
          {clientError}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {state.added} added, {state.updated} updated.
        </p>
      ) : null}
      <Button type="submit" disabled={!file || isPending}>
        {isPending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
};

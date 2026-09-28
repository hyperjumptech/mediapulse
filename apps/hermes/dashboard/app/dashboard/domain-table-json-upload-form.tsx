"use client";

import { Upload } from "lucide-react";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";
import { DialogClose } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import {
  FormDialogBody,
  FormDialogFooter,
  formDialogFormClassName,
} from "@/components/form-dialog";

import {
  useDomainTableJsonUploadForm,
  type DomainTableJsonImportAction,
} from "./use-domain-table-json-upload-form";

export type DomainTableJsonUploadFormProps = {
  action: DashboardPageCustomAction;
  serverAction: DomainTableJsonImportAction;
};

export const DomainTableJsonUploadForm = ({
  action,
  serverAction,
}: DomainTableJsonUploadFormProps) => {
  const {
    state,
    file,
    errorMessage,
    handleFileChange,
    handleSubmit,
    isPending,
  } = useDomainTableJsonUploadForm({ action, serverAction });
  const inputId = `custom-action-${action.id}-file`;

  return (
    <form onSubmit={handleSubmit} className={formDialogFormClassName}>
      <FormDialogBody>
        <Field>
          <FieldLabel htmlFor={inputId}>JSON file</FieldLabel>
          <Input
            id={inputId}
            type="file"
            accept={action.accept ?? ".json,application/json"}
            onChange={handleFileChange}
            disabled={isPending}
            className="bg-background text-muted-foreground"
          />
        </Field>
        {state.status === "success" ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {state.added} added, {state.updated} updated.
          </p>
        ) : null}
      </FormDialogBody>
      <FormDialogFooter errorMessage={errorMessage}>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Close
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!file || isPending}>
          <Upload aria-hidden />
          {isPending ? "Importing…" : "Import"}
        </Button>
      </FormDialogFooter>
    </form>
  );
};

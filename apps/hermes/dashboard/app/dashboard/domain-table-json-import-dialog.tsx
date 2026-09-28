"use client";

import { FileJson } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";

import { FormDialogContent, FormDialogHeader } from "@/components/form-dialog";

import {
  DomainTableJsonUploadForm,
  type DomainTableJsonUploadFormProps,
} from "./domain-table-json-upload-form";

export const DomainTableJsonImportDialog = ({
  action,
  serverAction,
}: DomainTableJsonUploadFormProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={action.label}
      >
        <FileJson aria-hidden />
        <span className="hidden lg:inline">{action.label}</span>
      </Button>
    </DialogTrigger>
    <FormDialogContent hasDescription={Boolean(action.description)}>
      <FormDialogHeader title={action.label} description={action.description} />
      <DomainTableJsonUploadForm action={action} serverAction={serverAction} />
    </FormDialogContent>
  </Dialog>
);

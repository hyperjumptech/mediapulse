"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@workspace/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";

import { FormErrorAlert } from "@/components/form-error-alert";

export const formDialogFormClassName = "flex min-h-0 flex-1 flex-col";

type FormDialogContentProps = ComponentProps<typeof DialogContent> & {
  size?: "default" | "wide";
  hasDescription?: boolean;
};

const withoutDescriptionProps = { "aria-describedby": undefined };

export const FormDialogContent = ({
  size = "default",
  hasDescription = false,
  className,
  ...contentProps
}: FormDialogContentProps) => {
  const widthClassName = size === "wide" ? "sm:max-w-2xl" : "sm:max-w-lg";
  const describedByProps = hasDescription ? {} : withoutDescriptionProps;

  return (
    <DialogContent
      {...describedByProps}
      className={cn(
        "flex max-h-[min(90vh,56rem)] flex-col gap-0 overflow-hidden p-0",
        widthClassName,
        className,
      )}
      {...contentProps}
    />
  );
};

type FormDialogHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
};

export const FormDialogHeader = ({
  title,
  description,
}: FormDialogHeaderProps) => (
  <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
    <DialogTitle>{title}</DialogTitle>
    {description ? <DialogDescription>{description}</DialogDescription> : null}
  </DialogHeader>
);

export const FormDialogBody = ({
  className,
  ...bodyProps
}: ComponentProps<"div">) => (
  <div
    data-slot="form-dialog-body"
    className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
    {...bodyProps}
  />
);

type FormDialogFooterProps = {
  errorMessage?: string | null;
  children: ReactNode;
};

export const FormDialogFooter = ({
  errorMessage,
  children,
}: FormDialogFooterProps) => (
  <div
    data-slot="form-dialog-footer"
    className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-6 py-4"
  >
    {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  </div>
);

type FormDialogCancelButtonProps = {
  onCancel: () => void;
  disabled?: boolean;
};

export const FormDialogCancelButton = ({
  onCancel,
  disabled = false,
}: FormDialogCancelButtonProps) => (
  <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
    Cancel
  </Button>
);

type FormDialogMessageProps = {
  loading?: boolean;
  children: ReactNode;
};

export const FormDialogMessage = ({
  loading = false,
  children,
}: FormDialogMessageProps) => (
  <div className="flex min-h-40 items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
    {loading ? <Spinner aria-hidden="true" /> : null}
    <p>{children}</p>
  </div>
);

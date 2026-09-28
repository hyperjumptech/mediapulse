"use client";

import type { ComponentType, FormEvent, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

type ActionForm = ComponentType<{
  className?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}>;

export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending: boolean;
  destructive?: boolean;
  FormWithAction: ActionForm;
  hiddenFields: Array<{ name: string; value: string }>;
};

export const ConfirmActionDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  destructive = true,
  FormWithAction,
  hiddenFields,
}: ConfirmActionDialogProps) => {
  const buttonLabel = pending ? (pendingLabel ?? confirmLabel) : confirmLabel;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <FormWithAction>
            {hiddenFields.map((field) => (
              <input
                key={field.name}
                type="hidden"
                name={field.name}
                value={field.value}
                readOnly
              />
            ))}
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {pending ? <Spinner /> : null}
              {buttonLabel}
            </Button>
          </FormWithAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

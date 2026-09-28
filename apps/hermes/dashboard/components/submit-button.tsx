"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pending: boolean;
  pendingLabel: ReactNode;
};

export const SubmitButton = ({
  pending,
  pendingLabel,
  disabled,
  children,
  ...buttonProps
}: SubmitButtonProps) => {
  const isDisabled = pending || Boolean(disabled);

  return (
    <Button type="submit" disabled={isDisabled} {...buttonProps}>
      {pending ? <Spinner aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
};

type FormStatusSubmitButtonProps = Omit<SubmitButtonProps, "pending">;

export const FormStatusSubmitButton = (props: FormStatusSubmitButtonProps) => {
  const { pending } = useFormStatus();

  return <SubmitButton pending={pending} {...props} />;
};

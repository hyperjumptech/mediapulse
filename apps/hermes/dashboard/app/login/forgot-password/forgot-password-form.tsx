"use client";

import React, { useMemo } from "react";
import { CircleCheck } from "lucide-react";
import { useFormAction } from "./action/.generated/use-form-action";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { AuthFooterLink } from "@/components/auth-page-shell";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

/**
 * Derives forgot-password form state from the generated form action hook.
 */
const useForgotPasswordFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const successMessage = useMemo(() => {
    if (state && state.status === true) {
      return "If an account exists for that email, we sent a reset link.";
    }
    return null;
  }, [state]);

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }
    return null;
  }, [state]);

  return {
    FormWithAction,
    pending,
    successMessage,
    errorMessage,
  };
};

/**
 * Renders the forgot-password form (same success copy for all outcomes).
 */
export const ForgotPasswordForm = () => {
  const { FormWithAction, pending, successMessage, errorMessage } =
    useForgotPasswordFormState();

  return (
    <FormWithAction>
      <FieldGroup className="gap-6">
        {successMessage ? (
          <Alert role="status" className="border-success/40 bg-success/10">
            <CircleCheck className="text-success" aria-hidden="true" />
            <AlertDescription className="text-foreground">
              {successMessage}
            </AlertDescription>
          </Alert>
        ) : null}
        {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
        <Field>
          <FieldLabel htmlFor="body.email">Email</FieldLabel>
          <Input
            id="body.email"
            name="body.email"
            type="email"
            placeholder="admin@example.com"
            required
            autoComplete="email"
          />
        </Field>
        <SubmitButton
          pending={pending}
          pendingLabel="Sending…"
          className="w-full"
        >
          Send reset link
        </SubmitButton>
        <AuthFooterLink href="/login">Back to login</AuthFooterLink>
      </FieldGroup>
    </FormWithAction>
  );
};

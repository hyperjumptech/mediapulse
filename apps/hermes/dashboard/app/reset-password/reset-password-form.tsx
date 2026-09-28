"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { AuthFooterLink } from "@/components/auth-page-shell";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

type ResetPasswordFormProps = {
  token: string;
};

/**
 * Derives reset-password form state from the generated form action hook and redirects on success.
 */
const useResetPasswordFormState = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }
    return null;
  }, [state]);

  const success = useMemo(() => {
    return state && state.status === true;
  }, [state]);

  useEffect(() => {
    if (!success) {
      return;
    }
    router.push("/login");
  }, [success, router]);

  return {
    FormWithAction,
    pending,
    errorMessage,
  };
};

/**
 * Renders the self-service password reset form (token from email link).
 */
export const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const { FormWithAction, pending, errorMessage } = useResetPasswordFormState();

  return (
    <FormWithAction>
      <input type="hidden" name="body.token" value={token} />
      <FieldGroup className="gap-6">
        {errorMessage ? <FormErrorAlert message={errorMessage} /> : null}
        <Field>
          <FieldLabel htmlFor="body.newPassword">New password</FieldLabel>
          <Input
            id="body.newPassword"
            name="body.newPassword"
            type="password"
            placeholder="********"
            required
            minLength={4}
            autoComplete="new-password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="body.confirmPassword">
            Confirm password
          </FieldLabel>
          <Input
            id="body.confirmPassword"
            name="body.confirmPassword"
            type="password"
            placeholder="********"
            required
            minLength={4}
            autoComplete="new-password"
          />
        </Field>
        <SubmitButton
          pending={pending}
          pendingLabel="Saving…"
          className="w-full"
        >
          Update password
        </SubmitButton>
        <AuthFooterLink href="/login/forgot-password">
          Request a new link
        </AuthFooterLink>
      </FieldGroup>
    </FormWithAction>
  );
};

"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { AuthFooterLink } from "@/components/auth-page-shell";
import { nativeCheckboxClassName } from "@/components/form-boolean-checkbox-field";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";

type LoginActionData = {
  id: string;
  name: string;
  email: string;
};

/**
 * Derives login form state from the generated form action hook and handles redirect on success.
 */
const useLoginFormState = () => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }

    return null;
  }, [state]);

  const data = useMemo<LoginActionData | null>(() => {
    if (state && state.status === true) {
      return state.data;
    }

    return null;
  }, [state]);

  useEffect(() => {
    if (!data) {
      return;
    }

    router.push("/dashboard");
  }, [data, router]);

  return {
    FormWithAction,
    pending,
    errorMessage,
  };
};

/**
 * Renders the admin login form and redirects on success.
 */
export const LoginForm = () => {
  const { FormWithAction, pending, errorMessage } = useLoginFormState();

  return (
    <FormWithAction>
      <FieldGroup className="gap-6">
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
        <Field>
          <FieldLabel htmlFor="body.password">Password</FieldLabel>
          <Input
            id="body.password"
            name="body.password"
            type="password"
            placeholder="********"
            required
            autoComplete="current-password"
          />
        </Field>
        <Field orientation="horizontal">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            value="on"
            className={nativeCheckboxClassName}
          />
          <FieldLabel
            htmlFor="rememberMe"
            className="cursor-pointer font-normal"
          >
            Remember me
          </FieldLabel>
        </Field>
        <SubmitButton
          pending={pending}
          pendingLabel="Signing in..."
          className="w-full"
        >
          Login
        </SubmitButton>
        <AuthFooterLink href="/login/forgot-password">
          Forgot password?
        </AuthFooterLink>
      </FieldGroup>
    </FormWithAction>
  );
};

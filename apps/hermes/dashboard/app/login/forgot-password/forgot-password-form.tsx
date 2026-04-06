"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useFormAction } from "./action/.generated/use-form-action";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

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
    <FormWithAction className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Enter your admin email. If an account exists, you will receive a reset
          link.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {successMessage ? (
          <p className="text-sm text-muted-foreground" role="status">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="body.email">Email</Label>
          <Input
            id="body.email"
            name="body.email"
            type="email"
            placeholder="admin@example.com"
            required
            autoComplete="email"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </FormWithAction>
  );
};

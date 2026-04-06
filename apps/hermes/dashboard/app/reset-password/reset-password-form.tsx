"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

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
    <FormWithAction className="flex flex-col gap-6">
      <input type="hidden" name="body.token" value={token} />
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Choose a new password for your Hermes admin account.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="body.newPassword">New password</Label>
          <Input
            id="body.newPassword"
            name="body.newPassword"
            type="password"
            placeholder="********"
            required
            minLength={4}
            autoComplete="new-password"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="body.confirmPassword">Confirm password</Label>
          <Input
            id="body.confirmPassword"
            name="body.confirmPassword"
            type="password"
            placeholder="********"
            required
            minLength={4}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Update password"}
        </Button>
        <p className="text-center text-sm">
          <Link
            href="/login/forgot-password"
            className="text-primary underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    </FormWithAction>
  );
};

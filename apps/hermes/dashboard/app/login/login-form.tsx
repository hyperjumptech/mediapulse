"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

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
    <FormWithAction className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">Welcome to Hermes</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Enter your admin email and password to log in.
        </p>
      </div>
      <div className="flex flex-col gap-4">
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
        <div className="grid gap-2">
          <Label htmlFor="body.password">Password</Label>
          <Input
            id="body.password"
            name="body.password"
            type="password"
            placeholder="********"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            value="on"
            aria-describedby="rememberMe-description"
            className="size-4 rounded border border-input"
          />
          <Label
            id="rememberMe-description"
            htmlFor="rememberMe"
            className="cursor-pointer text-sm font-normal"
          >
            Remember me
          </Label>
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in..." : "Login"}
        </Button>
        <p className="text-center text-sm">
          <Link
            href="/login/forgot-password"
            className="text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </FormWithAction>
  );
};

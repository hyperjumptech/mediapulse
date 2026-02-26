"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "./action/.generated/use-form-action";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type LoginActionData = {
  id: string;
  name: string;
  email: string;
};

/**
 * Derives login form state from the generated form action hook.
 */
const useLoginFormState = () => {
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

  return {
    FormWithAction,
    pending,
    errorMessage,
    data,
  };
};

/**
 * Renders the admin login form and redirects on success.
 */
export const LoginForm = () => {
  const router = useRouter();
  const { FormWithAction, pending, errorMessage, data } = useLoginFormState();

  useEffect(() => {
    if (!data) {
      return;
    }

    router.push("/dashboard");
  }, [data, router]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin login</CardTitle>
        <CardDescription>
          Sign in with your admin email and password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormWithAction className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="body.password">Password</Label>
            <Input
              id="body.password"
              name="body.password"
              type="password"
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </FormWithAction>
      </CardContent>
    </Card>
  );
};

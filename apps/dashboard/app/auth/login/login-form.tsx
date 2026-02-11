"use client";

import { useMemo } from "react";
import { useFormAction } from "./action/.generated/use-form-action";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";

const useLoginForm = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }
    return null;
  }, [state]);

  const data = useMemo(() => {
    if (state && state.status === true) {
      return state.data;
    }
    return null;
  }, [state]);

  return { FormWithAction, pending, errorMessage, data };
};

export const LoginForm = () => {
  const { FormWithAction, pending, errorMessage, data } = useLoginForm();

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
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
              placeholder="you@example.com"
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
              placeholder="Your super secret password"
              required
              autoComplete="current-password"
            />
          </div>
          {data && (
            <p className="text-sm text-muted-foreground">
              Welcome back, {data.name}!
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Logging in\u2026" : "Log in"}
          </Button>
        </FormWithAction>
      </CardContent>
    </Card>
  );
};

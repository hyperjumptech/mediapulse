"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { useFormAction } from "../logout/action/.generated/use-form-action";

type LogoutActionData = {
  redirectTo: "/login";
};

/**
 * Derives logout form state from the generated form action hook.
 *
 * @returns The form wrapper component and derived logout UI state.
 */
const useLogoutFormState = () => {
  const { FormWithAction, state, pending } = useFormAction();

  const errorMessage = useMemo(() => {
    if (state && state.status === false) {
      return state.message;
    }

    return null;
  }, [state]);

  const data = useMemo<LogoutActionData | null>(() => {
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
 * Renders a logout form and redirects to login after logout succeeds.
 *
 * @returns A logout form for authenticated admins.
 */
export const LogoutForm = () => {
  const router = useRouter();
  const { FormWithAction, pending, errorMessage, data } = useLogoutFormState();

  useEffect(() => {
    if (!data) {
      return;
    }

    router.replace(data.redirectTo);
  }, [data, router]);

  return (
    <FormWithAction className="flex items-center gap-2">
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Signing out..." : "Sign out"}
      </Button>
    </FormWithAction>
  );
};

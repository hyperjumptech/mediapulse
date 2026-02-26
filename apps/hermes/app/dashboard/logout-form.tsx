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

type LogoutFormProps = {
  /** Optional form container className (e.g. for sidebar footer layout). */
  className?: string;
  /** Button variant when used in sidebar. */
  variant?: "outline" | "ghost";
  /** Optional button className for sidebar styling. */
  buttonClassName?: string;
};

/**
 * Renders a logout form and redirects to login after logout succeeds.
 *
 * @param props - Optional className, variant, and buttonClassName for sidebar usage.
 * @returns A logout form for authenticated admins.
 */
export const LogoutForm = ({
  className,
  variant = "outline",
  buttonClassName,
}: LogoutFormProps = {}) => {
  const router = useRouter();
  const { FormWithAction, pending, errorMessage, data } = useLogoutFormState();

  useEffect(() => {
    if (!data) {
      return;
    }

    router.replace(data.redirectTo);
  }, [data, router]);

  return (
    <FormWithAction className={className}>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        variant={variant}
        className={buttonClassName}
      >
        {pending ? "Signing out..." : "Sign out"}
      </Button>
    </FormWithAction>
  );
};

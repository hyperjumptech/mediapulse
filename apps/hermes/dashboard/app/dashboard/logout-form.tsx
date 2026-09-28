"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { Spinner } from "@workspace/ui/components/spinner";
import { useFormAction } from "../logout/action/.generated/use-form-action";

type LogoutActionData = {
  redirectTo: "/login";
};

/**
 * Derives logout form state from the generated form action hook and handles redirect on success.
 *
 * @returns The form wrapper component and derived logout UI state.
 */
const useLogoutFormState = () => {
  const router = useRouter();
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

  useEffect(() => {
    if (!data) {
      return;
    }

    router.replace(data.redirectTo);
  }, [data, router]);

  return {
    FormWithAction,
    pending,
    errorMessage,
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
  const { FormWithAction, pending, errorMessage } = useLogoutFormState();

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

const keepMenuOpenWhileLoggingOut = (event: Event) => {
  event.preventDefault();
};

export const LogoutMenuItem = () => {
  const { FormWithAction, pending, errorMessage } = useLogoutFormState();
  const label = pending ? "Logging out…" : "Log out";

  return (
    <FormWithAction>
      <DropdownMenuItem
        asChild
        disabled={pending}
        onSelect={keepMenuOpenWhileLoggingOut}
      >
        <button type="submit" className="w-full">
          {pending ? (
            <Spinner aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          {label}
        </button>
      </DropdownMenuItem>
      {errorMessage ? (
        <p className="px-2 py-1.5 text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </FormWithAction>
  );
};

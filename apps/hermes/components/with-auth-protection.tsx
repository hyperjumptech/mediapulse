import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type ServerComponent<Props extends Record<string, unknown>> =
  | ((props: Props) => React.ReactNode)
  | ((props: Props) => Promise<React.ReactNode>);

/**
 * Wraps a server component and redirects unauthenticated users to `/login`.
 */
export const withAuthProtection = <Props extends Record<string, unknown>>(
  WrappedComponent: ServerComponent<Props>,
) => {
  /**
   * Resolves auth cookie before rendering the wrapped component.
   */
  const ProtectedComponent = async (props: Props) => {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth-token")?.value;

    if (!authToken) {
      redirect("/login");
    }

    return <WrappedComponent {...props} />;
  };

  return ProtectedComponent;
};

import {
  createClearDashboardAuthCookies,
  createSessionClearCookieOptions,
} from "@/lib/auth-dashboard";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

export const requestValidator = createRequestValidator({});

export const responseValidator = z.object({
  redirectTo: z.literal("/login"),
});

type LogoutHandlerDependencies = {
  clearAdminSession?: () => Promise<void>;
};

type LogoutHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/** @deprecated Use `createClearDashboardAuthCookies` from `@/lib/auth-dashboard`. */
export const createClearAdminSession = createClearDashboardAuthCookies;

export { createSessionClearCookieOptions };

const clearAdminSession = createClearDashboardAuthCookies();

/**
 * Creates the logout handler with injectable collaborators for tests.
 *
 * @param dependencies - Optional injected dependencies for tests.
 * @returns A logout handler function.
 */
export const createLogoutHandler = ({
  clearAdminSession: clearSession = clearAdminSession,
}: LogoutHandlerDependencies = {}): LogoutHandler => {
  /**
   * Clears the active admin session and returns the login redirect target.
   *
   * @returns A success response with the login route target.
   */
  return async () => {
    await clearSession();

    return successResponse({
      redirectTo: "/login",
    });
  };
};

/**
 * Handles admin logout by clearing the auth cookie.
 */
export const handler: HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
> = createLogoutHandler();

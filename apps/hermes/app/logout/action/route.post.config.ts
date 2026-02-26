import { cookies } from "next/headers";
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

type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

type SessionCookieStore = {
  set: (name: string, value: string, options: SessionCookieOptions) => void;
};

type ClearAdminSessionDependencies = {
  getCookieStore?: () => Promise<SessionCookieStore>;
};

type LogoutHandlerDependencies = {
  clearAdminSession?: () => Promise<void>;
};

type LogoutHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Returns cookie options that expire the admin auth cookie immediately.
 *
 * @returns Cookie options used to clear the admin auth cookie.
 */
export const createSessionClearCookieOptions = (): SessionCookieOptions => {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
};

/**
 * Creates a function that clears the persisted admin session cookie.
 *
 * @param dependencies - Optional injected dependencies for tests.
 * @returns A function that clears the admin auth cookie.
 */
export const createClearAdminSession = ({
  getCookieStore = cookies,
}: ClearAdminSessionDependencies = {}) => {
  /**
   * Clears the auth cookie for the current admin session.
   *
   * @returns A promise that resolves once the cookie has been cleared.
   */
  return async () => {
    const cookieStore = await getCookieStore();
    const clearOpts = createSessionClearCookieOptions();
    cookieStore.set("auth-token", "", clearOpts);
    cookieStore.set("auth-user", "", clearOpts);
  };
};

const clearAdminSession = createClearAdminSession();

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

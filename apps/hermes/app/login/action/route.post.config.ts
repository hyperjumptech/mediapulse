import bcrypt from "bcrypt";
import { prismaClient } from "@workspace/database/client";
import { cookies } from "next/headers";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

const bodyValidator = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
};

type AuthenticatedAdmin = z.infer<typeof responseValidator>;

type AuthenticateAdminDependencies = {
  findUserByEmail?: (email: string) => Promise<UserRecord | null>;
  comparePassword?: (
    plainTextPassword: string,
    hashedPassword: string,
  ) => Promise<boolean>;
};

type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

type SessionCookieStore = {
  set: (name: string, value: string, options: SessionCookieOptions) => void;
};

type PersistAdminSessionDependencies = {
  getCookieStore?: () => Promise<SessionCookieStore>;
  createSessionToken?: () => string;
};

type LoginHandlerDependencies = {
  authenticateAdmin?: AuthenticateAdminFn;
  persistAdminSession?: (admin: AuthenticatedAdmin) => Promise<void>;
};

type AuthenticateAdminFn = (
  credentials: z.infer<typeof bodyValidator>,
) => Promise<AuthenticatedAdmin | null>;

type LoginHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Builds a random token to represent an authenticated admin session.
 */
export const createSessionToken = () => {
  return `admin-session-${crypto.randomUUID()}`;
};

/**
 * Returns secure defaults used for the admin auth cookie.
 */
export const createSessionCookieOptions = (): SessionCookieOptions => {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  };
};

/**
 * Creates a session persister that writes the auth cookie on successful login.
 */
export const createPersistAdminSession = ({
  getCookieStore = cookies,
  createSessionToken: createToken = createSessionToken,
}: PersistAdminSessionDependencies = {}) => {
  /**
   * Persists session cookie and user payload (name, email) for the authenticated admin.
   */
  return async (admin: AuthenticatedAdmin) => {
    const cookieStore = await getCookieStore();
    const opts = createSessionCookieOptions();
    cookieStore.set("auth-token", createToken(), opts);
    cookieStore.set(
      "auth-user",
      JSON.stringify({ name: admin.name, email: admin.email }),
      opts,
    );
  };
};

/**
 * Creates an admin-authentication function with injectable dependencies for tests.
 */
export const createAuthenticateAdmin = ({
  findUserByEmail = async (email) =>
    prismaClient.user.findUnique({
      where: { email },
    }),
  comparePassword = bcrypt.compare,
}: AuthenticateAdminDependencies = {}) => {
  /**
   * Validates credentials and returns the authenticated admin payload.
   */
  return async (
    credentials: z.infer<typeof bodyValidator>,
  ): Promise<AuthenticatedAdmin | null> => {
    const user = await findUserByEmail(credentials.email);
    if (!user || user.role !== "ADMIN") {
      return null;
    }

    const isValidPassword = await comparePassword(
      credentials.password,
      user.password,
    );
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  };
};

const authenticateAdmin = createAuthenticateAdmin();
const persistAdminSession = createPersistAdminSession();

/**
 * Creates the login handler with injectable collaborators for tests.
 */
export const createLoginHandler = ({
  authenticateAdmin: authenticate = authenticateAdmin,
  persistAdminSession: persistSession = persistAdminSession,
}: LoginHandlerDependencies = {}): LoginHandler => {
  /**
   * Handles admin login via email/password and persists a session cookie.
   */
  return async (data) => {
    const authenticatedAdmin = await authenticate(data.body);

    if (!authenticatedAdmin) {
      return errorResponse("Invalid credentials");
    }

    await persistSession(authenticatedAdmin);
    return successResponse(authenticatedAdmin);
  };
};

/**
 * Handles admin login via email/password.
 */
export const handler: HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
> = createLoginHandler();

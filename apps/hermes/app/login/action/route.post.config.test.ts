/** @vitest-environment node */
import { prismaClient } from "@workspace/database/client";
import bcrypt from "bcrypt";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createAuthenticateAdmin,
  createLoginHandler,
  createPersistAdminSession,
  createSessionCookieOptions,
  handler,
} from "./route.post.config";

vi.mock("@workspace/database/client", () => ({
  prismaClient: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

/**
 * Returns the mocked prisma user lookup function.
 */
const getFindUniqueMock = () => {
  return prismaClient.user.findUnique as unknown as Mock;
};

/**
 * Returns the mocked bcrypt compare function.
 */
const getComparePasswordMock = () => {
  return bcrypt.compare as unknown as Mock;
};

/**
 * Returns the mocked next cookies function.
 */
const getCookiesMock = async () => {
  const mod = await import("next/headers");
  return mod.cookies as unknown as Mock;
};

/**
 * Creates a stable authenticated admin object for tests.
 */
const createAuthenticatedAdmin = () => {
  return {
    id: "user_1",
    name: "Admin User",
    email: "admin@example.com",
  };
};

describe("createAuthenticateAdmin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when user is missing", async () => {
    // Setup
    const authenticateAdmin = createAuthenticateAdmin({
      findUserByEmail: async () => null,
    });

    // Act
    const result = await authenticateAdmin({
      email: "admin@example.com",
      password: "password123",
    });

    // Assert
    expect(result).toBeNull();
  });

  it("returns null when role is not ADMIN", async () => {
    // Setup
    const authenticateAdmin = createAuthenticateAdmin({
      findUserByEmail: async () => ({
        id: "user_1",
        name: "Editor User",
        email: "editor@example.com",
        password: "hashed",
        role: "EDITOR",
      }),
      comparePassword: async () => true,
    });

    // Act
    const result = await authenticateAdmin({
      email: "editor@example.com",
      password: "password123",
    });

    // Assert
    expect(result).toBeNull();
  });

  it("returns null when password is invalid", async () => {
    // Setup
    const authenticateAdmin = createAuthenticateAdmin({
      findUserByEmail: async () => ({
        id: "user_1",
        name: "Admin User",
        email: "admin@example.com",
        password: "hashed",
        role: "ADMIN",
      }),
      comparePassword: async () => false,
    });

    // Act
    const result = await authenticateAdmin({
      email: "admin@example.com",
      password: "wrong-password",
    });

    // Assert
    expect(result).toBeNull();
  });

  it("returns user payload when credentials are valid", async () => {
    // Setup
    const authenticateAdmin = createAuthenticateAdmin({
      findUserByEmail: async () => ({
        id: "user_1",
        name: "Admin User",
        email: "admin@example.com",
        password: "hashed",
        role: "ADMIN",
      }),
      comparePassword: async () => true,
    });

    // Act
    const result = await authenticateAdmin({
      email: "admin@example.com",
      password: "password123",
    });

    // Assert
    expect(result).toEqual({
      id: "user_1",
      name: "Admin User",
      email: "admin@example.com",
    });
  });
});

describe("createPersistAdminSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes auth-token cookie with session defaults", async () => {
    // Setup
    const setCookie = vi.fn();
    const persistSession = createPersistAdminSession({
      getCookieStore: async () => ({
        set: setCookie,
      }),
      createSessionToken: () => "session-token",
    });

    // Act
    await persistSession(createAuthenticatedAdmin());

    // Assert
    const opts = createSessionCookieOptions();
    expect(setCookie).toHaveBeenCalledWith("auth-token", "session-token", opts);
    expect(setCookie).toHaveBeenCalledWith(
      "auth-user",
      JSON.stringify({
        name: "Admin User",
        email: "admin@example.com",
      }),
      opts,
    );
  });
});

describe("createLoginHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when authentication fails", async () => {
    // Setup
    const persistSession = vi.fn();
    const loginHandler = createLoginHandler({
      authenticateAdmin: async () => null,
      persistAdminSession: persistSession,
    });

    // Act
    const result = await loginHandler({
      body: {
        email: "admin@example.com",
        password: "bad-password",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    });

    // Assert
    expect(result).toMatchObject({
      status: false,
      message: "Invalid credentials",
    });
    expect(persistSession).not.toHaveBeenCalled();
  });

  it("persists session and returns success for valid credentials", async () => {
    // Setup
    const persistSession = vi.fn();
    const authenticatedAdmin = createAuthenticatedAdmin();
    const loginHandler = createLoginHandler({
      authenticateAdmin: async () => authenticatedAdmin,
      persistAdminSession: persistSession,
    });

    // Act
    const result = await loginHandler({
      body: {
        email: "admin@example.com",
        password: "password123",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    });

    // Assert
    expect(persistSession).toHaveBeenCalledWith(authenticatedAdmin);
    expect(result).toMatchObject({
      status: true,
      data: authenticatedAdmin,
    });
  });
});

describe("handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an error response for invalid credentials", async () => {
    // Setup
    const findUniqueMock = getFindUniqueMock();
    const comparePasswordMock = getComparePasswordMock();
    findUniqueMock.mockResolvedValue(null);
    comparePasswordMock.mockResolvedValue(false);

    // Act
    const result = await handler({
      body: {
        email: "admin@example.com",
        password: "bad-password",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result).toMatchObject({
      status: false,
      message: "Invalid credentials",
    });
  });

  it("returns a success response for valid credentials", async () => {
    // Setup
    const findUniqueMock = getFindUniqueMock();
    const comparePasswordMock = getComparePasswordMock();
    const cookiesMock = await getCookiesMock();
    const setCookieMock = vi.fn();
    cookiesMock.mockResolvedValue({
      set: setCookieMock,
    });
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      name: "Admin User",
      email: "admin@example.com",
      password: "hashed-password",
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    comparePasswordMock.mockResolvedValue(true);

    // Act
    const result = await handler({
      body: {
        email: "admin@example.com",
        password: "password123",
      },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(result).toMatchObject({
      status: true,
      data: {
        id: "user_1",
        name: "Admin User",
        email: "admin@example.com",
      },
    });
    expect(setCookieMock).toHaveBeenCalledTimes(2);
    expect(setCookieMock).toHaveBeenCalledWith(
      "auth-user",
      JSON.stringify({ name: "Admin User", email: "admin@example.com" }),
      expect.any(Object),
    );
  });
});

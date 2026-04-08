/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { logger } from "@workspace/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMemorySlidingRateLimitForTests } from "@/lib/memory-sliding-rate-limit";
import {
  bodyValidator,
  buildHermesAdminResetPasswordUrl,
  createForgotPasswordHandler,
} from "./route.post.config";

describe("buildHermesAdminResetPasswordUrl", () => {
  it("strips trailing slash from base and encodes token", () => {
    const url = buildHermesAdminResetPasswordUrl(
      "http://localhost:3001/",
      "abc/def+",
    );
    expect(url).toBe("http://localhost:3001/reset-password?token=abc%2Fdef%2B");
  });
});

describe("createForgotPasswordHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetMemorySlidingRateLimitForTests();
  });

  it("returns ok true when user is not found (anti-enumeration)", async () => {
    const handler = createForgotPasswordHandler({
      db: {
        user: { findUnique: vi.fn().mockResolvedValue(null) },
        hermesAdminPasswordResetToken: { create: vi.fn() },
      } as never,
      sendResetEmail: vi.fn(),
    });
    const result = await handler({
      body: bodyValidator.parse({ email: "nobody@example.com" }),
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result).toMatchObject({ status: true, data: { ok: true } });
  });

  it("creates token and sends email for active admin", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      role: UserRole.ADMIN,
      isActive: true,
    });
    const create = vi.fn().mockResolvedValue({ id: "t1" });
    const sendResetEmail = vi.fn().mockResolvedValue(undefined);
    const generateToken = vi.fn().mockReturnValue({
      rawToken: "raw",
      tokenHash: "hash",
    });
    const handler = createForgotPasswordHandler({
      db: {
        user: { findUnique },
        hermesAdminPasswordResetToken: { create },
      } as never,
      getPublicBaseUrl: () => "http://localhost:3001",
      generateToken,
      now: () => 1_000_000,
      sendResetEmail,
    });
    const result = await handler({
      body: bodyValidator.parse({ email: "  Admin@Example.com  " }),
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result).toMatchObject({ status: true, data: { ok: true } });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "admin@example.com" },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        tokenHash: "hash",
        expiresAt: new Date(1_000_000 + 60 * 60 * 1000),
      },
    });
    expect(sendResetEmail).toHaveBeenCalledWith({
      to: "admin@example.com",
      resetUrl: "http://localhost:3001/reset-password?token=raw",
    });
  });

  it("skips token when user is not admin", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      role: UserRole.USER,
      isActive: true,
    });
    const create = vi.fn();
    const handler = createForgotPasswordHandler({
      db: {
        user: { findUnique },
        hermesAdminPasswordResetToken: { create },
      } as never,
      sendResetEmail: vi.fn(),
    });
    await handler({
      body: bodyValidator.parse({ email: "u@example.com" }),
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns error when forgot-password rate limit is exceeded", async () => {
    const handler = createForgotPasswordHandler({
      db: {
        user: { findUnique: vi.fn() },
        hermesAdminPasswordResetToken: { create: vi.fn() },
      } as never,
      checkForgotRateLimit: () => false,
      sendResetEmail: vi.fn(),
    });
    const result = await handler({
      body: { email: "a@b.com" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Too many requests. Please wait before trying again.",
    );
  });

  it("still returns ok when sendResetEmail throws", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      role: UserRole.ADMIN,
      isActive: true,
    });
    const sendErr = new Error("resend down");
    const handler = createForgotPasswordHandler({
      db: {
        user: { findUnique },
        hermesAdminPasswordResetToken: { create: vi.fn() },
      } as never,
      getPublicBaseUrl: () => "http://localhost:3001",
      generateToken: () => ({ rawToken: "x", tokenHash: "h" }),
      sendResetEmail: vi.fn().mockRejectedValue(sendErr),
    });
    const result = await handler({
      body: bodyValidator.parse({ email: "admin@example.com" }),
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result).toMatchObject({ status: true, data: { ok: true } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "hermes_admin_forgot_password_email_failed",
        userId: "u1",
        error: sendErr,
      }),
      "hermes_admin_forgot_password_email_failed",
    );
  });
});

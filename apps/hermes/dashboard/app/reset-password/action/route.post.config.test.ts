/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompleteSelfServicePasswordResetHandler } from "./route.post.config";

const baseData = {
  body: {
    token: "raw",
    newPassword: "newsecret",
    confirmPassword: "newsecret",
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

describe("createCompleteSelfServicePasswordResetHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when token is invalid", async () => {
    const handler = createCompleteSelfServicePasswordResetHandler({
      db: {
        hermesAdminPasswordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn(),
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Invalid or expired reset link.",
    );
  });

  it("runs transaction to update password and mark token used", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "tok1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", role: UserRole.ADMIN, isActive: true },
    });
    const userUpdate = vi.fn();
    const tokenUpdate = vi.fn();
    const transaction = vi.fn(async (fn: (tx: never) => Promise<void>) => {
      await fn({
        user: { update: userUpdate },
        hermesAdminPasswordResetToken: { update: tokenUpdate },
      } as never);
    });
    const handler = createCompleteSelfServicePasswordResetHandler({
      db: {
        hermesAdminPasswordResetToken: { findUnique },
        $transaction: transaction,
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalled();
    expect(tokenUpdate).toHaveBeenCalledWith({
      where: { id: "tok1" },
      data: { usedAt: expect.any(Date) },
    });
  });
});

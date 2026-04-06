/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { describe, expect, it, vi } from "vitest";
import { hashHermesAdminResetToken } from "./hermes-admin-reset-token";
import { lookupHermesAdminResetToken } from "./lookup-hermes-admin-reset-token";

describe("lookupHermesAdminResetToken", () => {
  const raw = "test-raw-token";
  const tokenHash = hashHermesAdminResetToken(raw);
  const now = new Date("2025-01-01T12:00:00.000Z");

  it("returns not_found when no row", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const result = await lookupHermesAdminResetToken(
      { hermesAdminPasswordResetToken: { findUnique } } as never,
      raw,
      now,
    );
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      include: {
        user: { select: { id: true, role: true, isActive: true } },
      },
    });
  });

  it("returns used when token already consumed", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: new Date(now.getTime() + 1000),
      user: { id: "u1", role: UserRole.ADMIN, isActive: true },
    });
    const result = await lookupHermesAdminResetToken(
      { hermesAdminPasswordResetToken: { findUnique } } as never,
      raw,
      now,
    );
    expect(result).toEqual({ ok: false, reason: "used" });
  });

  it("returns expired when past expiresAt", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(now.getTime() - 1000),
      user: { id: "u1", role: UserRole.ADMIN, isActive: true },
    });
    const result = await lookupHermesAdminResetToken(
      { hermesAdminPasswordResetToken: { findUnique } } as never,
      raw,
      now,
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("returns not_eligible for non-admin", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1000),
      user: { id: "u1", role: UserRole.USER, isActive: true },
    });
    const result = await lookupHermesAdminResetToken(
      { hermesAdminPasswordResetToken: { findUnique } } as never,
      raw,
      now,
    );
    expect(result).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("returns ok with ids for valid admin token", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1000),
      user: { id: "u1", role: UserRole.ADMIN, isActive: true },
    });
    const result = await lookupHermesAdminResetToken(
      { hermesAdminPasswordResetToken: { findUnique } } as never,
      raw,
      now,
    );
    expect(result).toEqual({
      ok: true,
      tokenId: "t1",
      userId: "u1",
    });
  });
});

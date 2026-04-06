/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequireHermesAdminManagementActor } from "./require-hermes-admin-management-actor";

describe("createRequireHermesAdminManagementActor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok false when session is null", async () => {
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => null,
      db: { findUnique: vi.fn() },
    });
    const result = await requireActor();
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when user is missing", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      }),
      db: { findUnique },
    });
    const result = await requireActor();
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when role is not ADMIN", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      role: "USER",
      isActive: true,
      credentialVersion: 0,
    });
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      }),
      db: { findUnique },
    });
    const result = await requireActor();
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when admin is inactive", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: false,
      credentialVersion: 0,
    });
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      }),
      db: { findUnique },
    });
    const result = await requireActor();
    expect(result).toEqual({ ok: false });
  });

  it("returns ok false when credentialVersion does not match DB", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      isActive: true,
      credentialVersion: 2,
    });
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => ({
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 1,
      }),
      db: { findUnique },
    });
    const result = await requireActor();
    expect(result).toEqual({ ok: false });
  });

  it("returns ok true with session and actor when admin is active", async () => {
    const actorRow = {
      id: "u1",
      role: "ADMIN",
      isActive: true,
      credentialVersion: 0,
    };
    const findUnique = vi.fn().mockResolvedValue(actorRow);
    const session = {
      id: "u1",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    };
    const requireActor = createRequireHermesAdminManagementActor({
      getSession: async () => session,
      db: { findUnique },
    });
    const result = await requireActor();
    expect(result).toEqual({
      ok: true,
      session,
      actor: actorRow,
    });
  });
});

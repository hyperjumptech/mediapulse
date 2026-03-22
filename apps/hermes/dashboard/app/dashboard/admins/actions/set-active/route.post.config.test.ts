/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSetActiveAdminHandler } from "./route.post.config";

const targetId = "00000000-0000-4000-8000-000000000099";

const sessionUser = { id: "actor", name: "A", email: "a@b.com" };

const okGate = () =>
  ({
    ok: true as const,
    session: sessionUser,
    actor: { id: "actor", role: "ADMIN", isActive: true },
  }) as const;

describe("createSetActiveAdminHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when actor gate fails", async () => {
    const handler = createSetActiveAdminHandler({
      requireHermesAdminManagementActor: async () => ({ ok: false }),
      db: {} as never,
    });
    const result = await handler({
      body: { id: targetId, active: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("rejects disabling self", async () => {
    const handler = createSetActiveAdminHandler({
      requireHermesAdminManagementActor: async () => ({
        ok: true,
        session: { ...sessionUser, id: targetId },
        actor: { id: targetId, role: "ADMIN", isActive: true },
      }),
      db: {} as never,
    });
    const result = await handler({
      body: { id: targetId, active: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "You cannot disable your own account",
    );
  });

  it("rejects disabling last active admin", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    const count = vi.fn().mockResolvedValue(0);
    const update = vi.fn();
    const handler = createSetActiveAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { findUnique, count, update } } as never,
    });
    const result = await handler({
      body: { id: targetId, active: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Cannot disable the last active admin",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("allows disabling when another active admin exists", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    const count = vi.fn().mockResolvedValue(1);
    const update = vi.fn().mockResolvedValue({ id: targetId });
    const handler = createSetActiveAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { findUnique, count, update } } as never,
    });
    const result = await handler({
      body: { id: targetId, active: false },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { isActive: false },
    });
  });

  it("updates isActive when enabling", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: false,
    });
    const update = vi.fn().mockResolvedValue({ id: targetId });
    const handler = createSetActiveAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { findUnique, count: vi.fn(), update } } as never,
    });
    const result = await handler({
      body: { id: targetId, active: true },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { isActive: true },
    });
  });
});

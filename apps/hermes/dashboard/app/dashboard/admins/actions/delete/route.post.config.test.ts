/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteAdminHandler } from "./route.post.config";

const targetId = "00000000-0000-4000-8000-000000000099";

const baseData = {
  body: { id: targetId },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

const sessionUser = { id: "actor", name: "A", email: "a@b.com" };

const okGate = () =>
  ({
    ok: true as const,
    session: sessionUser,
    actor: { id: "actor", role: "ADMIN", isActive: true },
  }) as const;

describe("createDeleteAdminHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when actor gate fails", async () => {
    const handler = createDeleteAdminHandler({
      requireHermesAdminManagementActor: async () => ({ ok: false }),
      db: {} as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("rejects deleting self", async () => {
    const handler = createDeleteAdminHandler({
      requireHermesAdminManagementActor: async () => ({
        ok: true,
        session: { ...sessionUser, id: targetId },
        actor: { id: targetId, role: "ADMIN", isActive: true },
      }),
      db: {} as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "You cannot delete your own account",
    );
  });

  it("rejects deleting last admin", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const handler = createDeleteAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: {
        user: { count, findUnique: vi.fn() },
        $transaction: vi.fn(),
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "Cannot delete the last admin user",
    );
    expect(count).toHaveBeenCalledWith({ where: { role: UserRole.ADMIN } });
  });

  it("rejects when target is not an admin", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.USER,
    });
    const handler = createDeleteAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: {
        user: { count, findUnique },
        $transaction: vi.fn(),
      } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Admin not found");
  });

  it("deletes user when target is admin", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
    });
    const deleteUser = vi.fn().mockResolvedValue({ id: targetId });
    const handler = createDeleteAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { count, findUnique, delete: deleteUser } } as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith({ where: { id: targetId } });
  });
});

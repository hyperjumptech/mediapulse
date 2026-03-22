/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResetAdminPasswordHandler } from "./route.post.config";

const targetId = "00000000-0000-4000-8000-000000000099";

const baseData = {
  body: { id: targetId, newPassword: "newsecret" },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

const okGate = () =>
  ({
    ok: true as const,
    session: { id: "actor", name: "A", email: "a@b.com" },
    actor: { id: "actor", role: "ADMIN", isActive: true },
  }) as const;

describe("createResetAdminPasswordHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when actor gate fails", async () => {
    const handler = createResetAdminPasswordHandler({
      requireHermesAdminManagementActor: async () => ({ ok: false }),
      db: {} as never,
      hashPassword: async () => "hashed",
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when target is not admin", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.USER,
    });
    const handler = createResetAdminPasswordHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { findUnique, update: vi.fn() } } as never,
      hashPassword: async () => "hashed",
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Admin not found");
  });

  it("hashes password and updates user", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
    });
    const update = vi.fn().mockResolvedValue({ id: targetId });
    const hashPassword = vi.fn().mockResolvedValue("hashed-new");
    const handler = createResetAdminPasswordHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { findUnique, update } } as never,
      hashPassword,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("newsecret");
    expect(update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { password: "hashed-new" },
    });
  });
});

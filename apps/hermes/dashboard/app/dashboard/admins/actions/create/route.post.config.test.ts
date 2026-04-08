/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreateAdminHandler } from "./route.post.config";

const baseBody = {
  name: "New Admin",
  email: "new@example.com",
  password: "secret",
};

const baseData = {
  body: baseBody,
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: undefined,
};

const okGate = () =>
  ({
    ok: true as const,
    session: {
      id: "actor",
      name: "A",
      email: "a@b.com",
      credentialVersion: 0,
    },
    actor: { id: "actor", role: "ADMIN", isActive: true, credentialVersion: 0 },
  }) as const;

describe("createCreateAdminHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unauthorized when actor gate fails", async () => {
    const handler = createCreateAdminHandler({
      requireHermesAdminManagementActor: async () => ({ ok: false }),
      db: {} as never,
      hashPassword: async () => "hashed",
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("creates admin and returns id", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new-id" });
    const handler = createCreateAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { create } } as never,
      hashPassword: async () => "hashed",
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe("new-id");
    expect(create).toHaveBeenCalledWith({
      data: {
        name: "New Admin",
        email: "new@example.com",
        password: "hashed",
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });
  });

  it("returns friendly error on unique email violation", async () => {
    const create = vi.fn().mockRejectedValue({ code: "P2002" });
    const handler = createCreateAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { create } } as never,
      hashPassword: async () => "hashed",
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe(
      "An admin with this email already exists",
    );
  });

  it("rethrows non-unique errors", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const handler = createCreateAdminHandler({
      requireHermesAdminManagementActor: async () => okGate(),
      db: { user: { create } } as never,
      hashPassword: async () => "hashed",
    });
    await expect(handler(baseData as never)).rejects.toThrow("db down");
  });
});

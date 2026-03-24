/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isEncryptedSecretVariablePayload } from "@hermes/domain-integration-crypto";
import { SECRET_MASK } from "@/lib/variables";
import { createUpdateVariableHandler } from "./route.post.config";

describe("createUpdateVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when session is null", async () => {
    const handler = createUpdateVariableHandler({
      getSession: async () => null,
      db: {} as never,
    });
    const result = await handler({
      body: { id: "v1" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Unauthorized");
  });

  it("returns error when variable not found", async () => {
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const handler = createUpdateVariableHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    const result = await handler({
      body: { id: "missing" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toBe("Variable not found");
  });

  it("does not update value when new value is SECRET_MASK", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "v1",
          key: "K",
          value: "secret",
          note: null,
          isSecret: true,
        }),
        update: updateMock,
      },
    };
    const handler = createUpdateVariableHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    const result = await handler({
      body: { id: "v1", note: "updated note", value: SECRET_MASK },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(result.status).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { note: "updated note" },
    });
  });

  it("updates value when non-empty and not mask", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "v1",
          key: "K",
          value: "old",
          note: null,
          isSecret: false,
        }),
        update: updateMock,
      },
    };
    const handler = createUpdateVariableHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });
    await handler({
      body: { id: "v1", value: "new-value" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { value: "new-value" },
    });
  });

  it("encrypts replacement value when target is secret", async () => {
    // Setup
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "v1",
          key: "K",
          value: "old",
          note: null,
          isSecret: true,
        }),
        update: updateMock,
      },
    };
    const handler = createUpdateVariableHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });

    // Act
    await handler({
      body: { id: "v1", value: "new-secret" },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    const call = updateMock.mock.calls[0]?.[0] as { data: { value: string } };
    expect(call.data.value).not.toBe("new-secret");
    expect(isEncryptedSecretVariablePayload(call.data.value)).toBe(true);
  });

  it("keeps plaintext value when toggling legacy secret row off", async () => {
    // Setup
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "v1",
          key: "K",
          value: "stored-secret",
          note: null,
          isSecret: true,
        }),
        update: updateMock,
      },
    };
    const handler = createUpdateVariableHandler({
      getSession: async () => ({
        id: "user-1",
        name: "Admin",
        email: "a@b.com",
      }),
      db: db as never,
    });

    // Act
    await handler({
      body: { id: "v1", isSecret: false, value: SECRET_MASK },
      params: {},
      headers: new Headers(),
      searchParams: {},
      user: undefined,
    } as never);

    // Assert
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: {
        isSecret: false,
        value: "stored-secret",
      },
    });
  });
});

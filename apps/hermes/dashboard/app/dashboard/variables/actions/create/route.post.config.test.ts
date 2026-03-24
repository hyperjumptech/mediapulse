/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isEncryptedSecretVariablePayload } from "@hermes/domain-integration-crypto";
import { createCreateVariableHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const baseData = {
  body: {
    key: "MY_VAR",
    value: "my-value",
    note: "optional note",
    isSecret: false,
  },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: mockDashboardUser,
};

describe("createCreateVariableHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when variable key already exists", async () => {
    const db = {
      variable: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "existing", key: "MY_VAR" }),
        create: vi.fn(),
      },
    };
    const handler = createCreateVariableHandler({
      db: db as never,
    });
    const result = await handler(baseData as never);
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain(
      "already exists",
    );
    expect(db.variable.create).not.toHaveBeenCalled();
  });

  it("creates variable and returns id", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateVariableHandler({
      db: db as never,
    });
    const result = await handler(baseData as never);

    expect(result.status).toBe(true);
    expect((result as { data?: { id: string } }).data?.id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(createMock).toHaveBeenCalledWith({
      data: {
        key: "MY_VAR",
        value: "my-value",
        note: "optional note",
        isSecret: false,
      },
    });
  });

  it("encrypts secret values before persisting", async () => {
    // Setup
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000003",
    });
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateVariableHandler({
      db: db as never,
    });

    // Act
    const result = await handler({
      ...baseData,
      body: { key: "SECRET_VAR", value: "s3cr3t", note: "", isSecret: true },
    } as never);

    // Assert
    expect(result.status).toBe(true);
    const createArg = createMock.mock.calls[0]?.[0] as {
      data: {
        value: string;
        encryptedPayload: { create: { ciphertext: string } };
      };
    };
    expect(createArg.data.value).toBe("");
    expect(
      isEncryptedSecretVariablePayload(
        createArg.data.encryptedPayload.create.ciphertext,
      ),
    ).toBe(true);
  });

  it("creates variable with null note when note is empty string", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
    });
    const db = {
      variable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    };
    const handler = createCreateVariableHandler({
      db: db as never,
    });
    const result = await handler({
      ...baseData,
      body: { key: "OTHER_VAR", value: "v", note: "", isSecret: false },
    } as never);

    expect(result.status).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        key: "OTHER_VAR",
        value: "v",
        note: null,
        isSecret: false,
      },
    });
  });
});

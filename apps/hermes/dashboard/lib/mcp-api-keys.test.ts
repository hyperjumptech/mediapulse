/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const { TEST_PEPPER } = vi.hoisted(() => ({
  TEST_PEPPER: "test-pepper-not-for-production",
}));

vi.mock("@hermes/env", () => ({
  env: {
    HERMES_MCP_API_KEY_PEPPER: TEST_PEPPER,
  },
}));

vi.mock("@hermes/orchestration-database", () => ({
  UserRole: { ADMIN: "ADMIN", USER: "USER" },
  prisma: {
    mcpApiKey: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { UserRole } from "@hermes/orchestration-database";

import {
  buildMcpApiKeyHashInput,
  createApiKey,
  generateMcpApiKeyPlaintext,
  hashMcpApiKey,
  MCP_API_KEY_PREFIX,
  revokeApiKey,
  timingSafeEqualHex,
  touchMcpApiKeyLastUsed,
  validateApiKey,
} from "./mcp-api-keys";

describe("buildMcpApiKeyHashInput", () => {
  it("concatenates pepper before plaintext", () => {
    expect(buildMcpApiKeyHashInput("token", "pep")).toBe("peptoken");
  });
});

describe("hashMcpApiKey", () => {
  it("returns stable hex for the same input", () => {
    const a = hashMcpApiKey("hmcp_ab_cdef", { pepper: TEST_PEPPER });
    const b = hashMcpApiKey("hmcp_ab_cdef", { pepper: TEST_PEPPER });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs when pepper differs", () => {
    const a = hashMcpApiKey("same", { pepper: "one" });
    const b = hashMcpApiKey("same", { pepper: "two" });
    expect(a).not.toBe(b);
  });
});

describe("timingSafeEqualHex", () => {
  it("returns true for equal digests", () => {
    const digest = hashMcpApiKey("x", { pepper: TEST_PEPPER });
    expect(timingSafeEqualHex(digest, digest)).toBe(true);
  });

  it("returns false for different digests", () => {
    expect(timingSafeEqualHex("aa", "ab")).toBe(false);
  });

  it("returns false for unequal lengths", () => {
    expect(timingSafeEqualHex("a", "aa")).toBe(false);
  });
});

describe("generateMcpApiKeyPlaintext", () => {
  it("uses hmcp prefix and two segments", () => {
    const { apiKeyPlaintext } = generateMcpApiKeyPlaintext();
    expect(apiKeyPlaintext.startsWith(`${MCP_API_KEY_PREFIX}_`)).toBe(true);
    const parts = apiKeyPlaintext.split("_");
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });
});

describe("validateApiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const plaintext = "hmcp_pub_secrettoken";
  const keyHash = hashMcpApiKey(plaintext, { pepper: TEST_PEPPER });

  const activeRow = {
    id: "key-1",
    label: "Cursor",
    readOnly: false,
    createdByUserId: "user-1",
    ownerCredentialVersion: 2,
    revokedAt: null as Date | null,
  };

  const activeOwner = {
    role: UserRole.ADMIN,
    isActive: true,
    credentialVersion: 2,
  };

  it("returns metadata for a valid active key and owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(activeRow);
    const findUnique = vi.fn().mockResolvedValue(activeOwner);

    const result = await validateApiKey(plaintext, {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique },
    });

    expect(result).toEqual({
      id: "key-1",
      label: "Cursor",
      readOnly: false,
      createdByUserId: "user-1",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { keyHash, revokedAt: null },
      }),
    );
  });

  it("returns null for unknown key hash", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const result = await validateApiKey("hmcp_x_y", {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique: vi.fn() },
    });
    expect(result).toBeNull();
  });

  it("returns null when key row is revoked", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      ...activeRow,
      revokedAt: new Date(),
    });
    const result = await validateApiKey(plaintext, {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique: vi.fn().mockResolvedValue(activeOwner) },
    });
    expect(result).toBeNull();
  });

  it("returns null when owner is not ADMIN", async () => {
    const findFirst = vi.fn().mockResolvedValue(activeRow);
    const findUnique = vi.fn().mockResolvedValue({
      ...activeOwner,
      role: UserRole.USER,
    });
    const result = await validateApiKey(plaintext, {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique },
    });
    expect(result).toBeNull();
  });

  it("returns null when owner credentialVersion mismatches snapshot", async () => {
    const findFirst = vi.fn().mockResolvedValue(activeRow);
    const findUnique = vi.fn().mockResolvedValue({
      ...activeOwner,
      credentialVersion: 99,
    });
    const result = await validateApiKey(plaintext, {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique },
    });
    expect(result).toBeNull();
  });

  it("does not log plaintext in findFirst arguments", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await validateApiKey(plaintext, {
      pepper: TEST_PEPPER,
      db: {
        findFirst,
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      userDb: { findUnique: vi.fn() },
    });
    const serialized = JSON.stringify(findFirst.mock.calls);
    expect(serialized).not.toContain(plaintext);
    expect(serialized).toContain(keyHash);
  });
});

describe("createApiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores hash only and returns plaintext once", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      role: UserRole.ADMIN,
      isActive: true,
      credentialVersion: 1,
    });
    const create = vi
      .fn()
      .mockImplementation(async (args: { data: { keyHash: string } }) => ({
        id: "new-id",
        label: "Dev",
        readOnly: true,
        createdByUserId: "user-1",
        keyHash: args.data.keyHash,
      }));

    const result = await createApiKey(
      { label: " Dev ", readOnly: true, createdByUserId: "user-1" },
      {
        pepper: TEST_PEPPER,
        db: {
          findFirst: vi.fn(),
          create,
          update: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
        },
        userDb: { findUnique },
      },
    );

    expect(result.apiKeyPlaintext.startsWith(`${MCP_API_KEY_PREFIX}_`)).toBe(
      true,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: "Dev",
          readOnly: true,
          ownerCredentialVersion: 1,
          keyHash: hashMcpApiKey(result.apiKeyPlaintext, {
            pepper: TEST_PEPPER,
          }),
        }),
      }),
    );
    const createSerialized = JSON.stringify(create.mock.calls);
    expect(createSerialized).not.toContain(result.apiKeyPlaintext);
  });

  it("rejects non-admin owners", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      role: UserRole.USER,
      isActive: true,
      credentialVersion: 0,
    });
    await expect(
      createApiKey(
        { label: "x", readOnly: false, createdByUserId: "user-1" },
        {
          pepper: TEST_PEPPER,
          db: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
          },
          userDb: { findUnique },
        },
      ),
    ).rejects.toThrow(/active Hermes admin/);
  });
});

describe("revokeApiKey", () => {
  it("returns true when a row is updated", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const ok = await revokeApiKey("key-1", "admin-1", {
      db: { updateMany },
    });
    expect(ok).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "key-1", revokedAt: null },
      }),
    );
  });

  it("returns false when no row matches", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const ok = await revokeApiKey("missing", "admin-1", {
      db: { updateMany },
    });
    expect(ok).toBe(false);
  });
});

describe("touchMcpApiKeyLastUsed", () => {
  it("updates lastUsedAt", async () => {
    const update = vi.fn().mockResolvedValue({});
    await touchMcpApiKeyLastUsed("key-1", { db: { update } });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "key-1" },
        data: { lastUsedAt: expect.any(Date) },
      }),
    );
  });
});

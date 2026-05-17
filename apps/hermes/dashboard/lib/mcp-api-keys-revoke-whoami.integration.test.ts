/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const { TEST_PEPPER } = vi.hoisted(() => ({
  TEST_PEPPER: "integration-pepper",
}));

vi.mock("@hermes/env", () => ({
  env: { HERMES_MCP_API_KEY_PEPPER: TEST_PEPPER },
}));

const store = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    label: string;
    keyHash: string;
    readOnly: boolean;
    createdByUserId: string;
    ownerCredentialVersion: number;
    revokedAt: Date | null;
  }>,
}));

vi.mock("@hermes/orchestration-database", () => ({
  UserRole: { ADMIN: "ADMIN", USER: "USER" },
  prisma: {
    mcpApiKey: {
      findFirst: vi.fn(
        async ({ where }: { where: { keyHash: string; revokedAt: null } }) => {
          const row = store.rows.find(
            (r) => r.keyHash === where.keyHash && r.revokedAt === null,
          );
          if (!row) return null;
          return {
            id: row.id,
            label: row.label,
            readOnly: row.readOnly,
            createdByUserId: row.createdByUserId,
            ownerCredentialVersion: row.ownerCredentialVersion,
            revokedAt: row.revokedAt,
          };
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; revokedAt: null };
          data: { revokedAt: Date };
        }) => {
          const row = store.rows.find(
            (r) => r.id === where.id && r.revokedAt === null,
          );
          if (!row) return { count: 0 };
          row.revokedAt = data.revokedAt;
          return { count: 1 };
        },
      ),
    },
    user: {
      findUnique: vi.fn(async () => ({
        role: "ADMIN",
        isActive: true,
        credentialVersion: 0,
      })),
    },
  },
}));

import {
  generateMcpApiKeyPlaintext,
  hashMcpApiKey,
  revokeApiKey,
  validateApiKey,
} from "./mcp-api-keys";
import { GET } from "../app/api/mcp/whoami/route";

describe("revoke key fails whoami on next request", () => {
  afterEach(() => {
    store.rows.length = 0;
    vi.clearAllMocks();
  });

  it("returns 401 from whoami after revoke", async () => {
    const { apiKeyPlaintext } = generateMcpApiKeyPlaintext();
    const keyId = "key-integration-1";
    store.rows.push({
      id: keyId,
      label: "integration",
      keyHash: hashMcpApiKey(apiKeyPlaintext, { pepper: TEST_PEPPER }),
      readOnly: false,
      createdByUserId: "user-1",
      ownerCredentialVersion: 0,
      revokedAt: null,
    });

    expect(
      await validateApiKey(apiKeyPlaintext, { pepper: TEST_PEPPER }),
    ).not.toBeNull();

    await revokeApiKey(keyId, "admin-1");

    expect(
      await validateApiKey(apiKeyPlaintext, { pepper: TEST_PEPPER }),
    ).toBeNull();

    const res = await GET(
      new Request("http://localhost/api/mcp/whoami", {
        headers: { Authorization: `Bearer ${apiKeyPlaintext}` },
      }),
    );
    expect(res.status).toBe(401);
  });
});

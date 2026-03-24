/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const domainIntegrationFindMany = vi.fn();
const domainIntegrationUpdate = vi.fn();
const variableFindMany = vi.fn();
const variableUpdate = vi.fn();

vi.mock("../src", () => ({
  prisma: {
    domainIntegration: {
      findMany: (...args: unknown[]) => domainIntegrationFindMany(...args),
      update: (...args: unknown[]) => domainIntegrationUpdate(...args),
    },
    variable: {
      findMany: (...args: unknown[]) => variableFindMany(...args),
      update: (...args: unknown[]) => variableUpdate(...args),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock("@hermes/domain-integration-crypto", () => ({
  decryptDomainIntegrationApiKeyWithFallback: vi.fn(
    (ciphertext: string) => `plain-${ciphertext}`,
  ),
  encryptDomainIntegrationApiKey: vi.fn(
    (plaintext: string) => `rewrapped-${plaintext}`,
  ),
  decryptSecretVariableValueWithFallback: vi.fn((ciphertext: string) => {
    return `plain-${ciphertext}`;
  }),
  encryptSecretVariableValue: vi.fn(
    (plaintext: string) => `rewrapped-${plaintext}`,
  ),
  isEncryptedSecretVariablePayload: vi.fn((value: string) =>
    value.startsWith("{"),
  ),
}));

describe("rotateInternalKeyCiphertexts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    domainIntegrationFindMany.mockReset();
    domainIntegrationUpdate.mockReset();
    variableFindMany.mockReset();
    variableUpdate.mockReset();
  });

  it("scans rows and skips writes in dry-run mode", async () => {
    // Setup
    domainIntegrationFindMany
      .mockResolvedValueOnce([
        { id: "di-1", key: "news", encryptedApiKey: "cipher-1" },
      ])
      .mockResolvedValueOnce([]);
    variableFindMany
      .mockResolvedValueOnce([
        { id: "v-1", key: "SECRET_ONE", value: '{"v":1}' },
        { id: "v-2", key: "SECRET_TWO", value: "plain-value" },
      ])
      .mockResolvedValueOnce([]);
    const { rotateInternalKeyCiphertexts } =
      await import("./rotate-internal-key-ciphertexts");

    // Act
    const result = await rotateInternalKeyCiphertexts({
      oldMasterKey: "old-key",
      newMasterKey: "new-key",
      dryRun: true,
      batchSize: 100,
    });

    // Assert
    expect(result.domainIntegration).toEqual({
      scanned: 1,
      updated: 1,
      skippedPlaintext: 0,
      failed: 0,
    });
    expect(result.secretVariables).toEqual({
      scanned: 2,
      updated: 1,
      skippedPlaintext: 1,
      failed: 0,
    });
    expect(domainIntegrationUpdate).not.toHaveBeenCalled();
    expect(variableUpdate).not.toHaveBeenCalled();
  });

  it("updates rewrapped ciphertext when dry-run is disabled", async () => {
    // Setup
    domainIntegrationFindMany
      .mockResolvedValueOnce([
        { id: "di-1", key: "news", encryptedApiKey: "cipher-1" },
      ])
      .mockResolvedValueOnce([]);
    variableFindMany
      .mockResolvedValueOnce([
        { id: "v-1", key: "SECRET_ONE", value: '{"v":1}' },
      ])
      .mockResolvedValueOnce([]);
    const { rotateInternalKeyCiphertexts } =
      await import("./rotate-internal-key-ciphertexts");

    // Act
    await rotateInternalKeyCiphertexts({
      oldMasterKey: "old-key",
      newMasterKey: "new-key",
      dryRun: false,
      batchSize: 100,
    });

    // Assert
    expect(domainIntegrationUpdate).toHaveBeenCalledOnce();
    expect(variableUpdate).toHaveBeenCalledOnce();
  });
});

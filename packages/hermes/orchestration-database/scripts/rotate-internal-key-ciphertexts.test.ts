/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const encryptedPayloadFindMany = vi.fn();
const encryptedPayloadUpdate = vi.fn();

vi.mock("../src", () => ({
  prisma: {
    encryptedPayload: {
      findMany: (...args: unknown[]) => encryptedPayloadFindMany(...args),
      update: (...args: unknown[]) => encryptedPayloadUpdate(...args),
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
    encryptedPayloadFindMany.mockReset();
    encryptedPayloadUpdate.mockReset();
  });

  it("scans rows and skips writes in dry-run mode", async () => {
    // Setup
    encryptedPayloadFindMany
      .mockResolvedValueOnce([
        {
          id: "ep-di",
          ciphertext: "cipher-di",
          domainIntegrationId: "di-1",
          variableId: null,
          domainIntegration: { integrationId: "news" },
          variable: null,
        },
        {
          id: "ep-v1",
          ciphertext: '{"v":1}',
          domainIntegrationId: null,
          variableId: "v-1",
          domainIntegration: null,
          variable: { key: "SECRET_ONE" },
        },
        {
          id: "ep-v2",
          ciphertext: "plain-value",
          domainIntegrationId: null,
          variableId: "v-2",
          domainIntegration: null,
          variable: { key: "SECRET_TWO" },
        },
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
    expect(result.encryptedPayload).toEqual({
      scanned: 3,
      updated: 2,
      skippedPlaintext: 1,
      failed: 0,
    });
    expect(encryptedPayloadUpdate).not.toHaveBeenCalled();
  });

  it("updates rewrapped ciphertext when dry-run is disabled", async () => {
    // Setup
    encryptedPayloadFindMany
      .mockResolvedValueOnce([
        {
          id: "ep-di",
          ciphertext: "cipher-di",
          domainIntegrationId: "di-1",
          variableId: null,
          domainIntegration: { integrationId: "news" },
          variable: null,
        },
        {
          id: "ep-v1",
          ciphertext: '{"v":1}',
          domainIntegrationId: null,
          variableId: "v-1",
          domainIntegration: null,
          variable: { key: "SECRET_ONE" },
        },
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
    expect(encryptedPayloadUpdate).toHaveBeenCalledTimes(2);
  });
});

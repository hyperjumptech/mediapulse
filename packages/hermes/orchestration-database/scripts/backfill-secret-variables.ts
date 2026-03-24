import { prisma } from "../src";
import {
  decryptSecretVariableValue,
  encryptSecretVariableValue,
  isEncryptedSecretVariablePayload,
} from "@hermes/domain-integration-crypto";

type BackfillResult = {
  scanned: number;
  encrypted: number;
  skippedAlreadyEncrypted: number;
};

/**
 * Encrypts legacy plaintext values for `variable.is_secret=true`.
 * The operation is idempotent and safe to re-run.
 *
 * @param masterKey - Hermes master key (`HERMES_INTERNAL_API_KEY`) used for wrapping.
 * @returns Counters for scanned and updated rows.
 */
export const backfillSecretVariables = async (
  masterKey: string,
): Promise<BackfillResult> => {
  const rows = await prisma.variable.findMany({
    where: { isSecret: true },
    select: { id: true, key: true, value: true },
  });
  let encrypted = 0;
  let skippedAlreadyEncrypted = 0;

  for (const row of rows) {
    if (isEncryptedSecretVariablePayload(row.value)) {
      try {
        void decryptSecretVariableValue(row.value, masterKey);
        skippedAlreadyEncrypted += 1;
        continue;
      } catch {
        throw new Error(
          `Variable "${row.key}" has encrypted payload that cannot be decrypted`,
        );
      }
    }

    const ciphertext = encryptSecretVariableValue(row.value, masterKey);
    await prisma.variable.update({
      where: { id: row.id },
      data: { value: ciphertext },
    });
    encrypted += 1;
  }

  return {
    scanned: rows.length,
    encrypted,
    skippedAlreadyEncrypted,
  };
};

/**
 * CLI entrypoint for one-time secret-variable backfill.
 * Usage: `pnpm --filter @hermes/orchestration-database backfill:secret-variables --master-key "<key>"`.
 */
const main = async (): Promise<void> => {
  const masterKeyFlagIndex = process.argv.findIndex(
    (arg) => arg === "--master-key",
  );
  const masterKey =
    masterKeyFlagIndex >= 0 ? process.argv[masterKeyFlagIndex + 1] : undefined;
  if (!masterKey) {
    throw new Error("Missing required --master-key argument");
  }
  const result = await backfillSecretVariables(masterKey);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
      },
      null,
      2,
    ),
  );
};

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`backfill-secret-variables failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

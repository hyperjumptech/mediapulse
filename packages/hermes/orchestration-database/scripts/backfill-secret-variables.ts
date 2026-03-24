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
 * Ensures `variable.is_secret=true` rows store ciphertext on `encrypted_payload` (empty `value`).
 * Idempotent: rows that already have a decryptable `encryptedPayload` are skipped.
 * Migrates legacy ciphertext still in `variable.value` into `encrypted_payload`.
 *
 * @param masterKey - Hermes master key (`HERMES_INTERNAL_API_KEY`) used for wrapping.
 * @returns Counters for scanned and updated rows.
 */
export const backfillSecretVariables = async (
  masterKey: string,
): Promise<BackfillResult> => {
  const rows = await prisma.variable.findMany({
    where: { isSecret: true },
    include: { encryptedPayload: true },
  });
  let encrypted = 0;
  let skippedAlreadyEncrypted = 0;

  for (const row of rows) {
    if (row.encryptedPayload?.ciphertext) {
      try {
        void decryptSecretVariableValue(
          row.encryptedPayload.ciphertext,
          masterKey,
        );
        skippedAlreadyEncrypted += 1;
        continue;
      } catch {
        throw new Error(
          `Variable "${row.key}" has encrypted payload that cannot be decrypted`,
        );
      }
    }

    if (isEncryptedSecretVariablePayload(row.value)) {
      await prisma.variable.update({
        where: { id: row.id },
        data: {
          value: "",
          encryptedPayload: {
            create: { ciphertext: row.value },
          },
        },
      });
      encrypted += 1;
      continue;
    }

    const ciphertext = encryptSecretVariableValue(row.value, masterKey);
    await prisma.variable.update({
      where: { id: row.id },
      data: {
        value: "",
        encryptedPayload: {
          create: { ciphertext },
        },
      },
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

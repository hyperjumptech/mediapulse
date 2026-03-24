import { prisma, type Prisma } from "../src";
import {
  decryptDomainIntegrationApiKeyWithFallback,
  decryptSecretVariableValueWithFallback,
  encryptDomainIntegrationApiKey,
  encryptSecretVariableValue,
  isEncryptedSecretVariablePayload,
} from "@hermes/domain-integration-crypto";

type RotateInternalKeyCiphertextsOptions = {
  oldMasterKey: string;
  newMasterKey: string;
  dryRun?: boolean;
  batchSize?: number;
};

type RotateBatchCounters = {
  scanned: number;
  updated: number;
  skippedPlaintext: number;
  failed: number;
};

type RotateInternalKeyCiphertextsResult = {
  domainIntegration: RotateBatchCounters;
  secretVariables: RotateBatchCounters;
};

const DEFAULT_BATCH_SIZE = 200;

/**
 * Rotates ciphertext rows that are wrapped by `HERMES_INTERNAL_API_KEY`.
 *
 * The script is idempotent: rows already encrypted with `newMasterKey` are still read and
 * rewritten to equivalent ciphertext for consistency, and plaintext secret variables are skipped.
 *
 * @param options - Rotation options including old/new keys, dry-run toggle, and batch size.
 * @returns Counters for domain integration and secret variable updates.
 */
export const rotateInternalKeyCiphertexts = async (
  options: RotateInternalKeyCiphertextsOptions,
): Promise<RotateInternalKeyCiphertextsResult> => {
  const oldMasterKey = options.oldMasterKey.trim();
  const newMasterKey = options.newMasterKey.trim();
  if (!oldMasterKey || !newMasterKey) {
    throw new Error("Both --old-master-key and --new-master-key are required");
  }

  const dryRun = options.dryRun === true;
  const batchSize =
    options.batchSize && options.batchSize > 0
      ? Math.floor(options.batchSize)
      : DEFAULT_BATCH_SIZE;

  const domainIntegration = await rotateDomainIntegrationCiphertexts({
    oldMasterKey,
    newMasterKey,
    dryRun,
    batchSize,
  });
  const secretVariables = await rotateSecretVariableCiphertexts({
    oldMasterKey,
    newMasterKey,
    dryRun,
    batchSize,
  });

  return { domainIntegration, secretVariables };
};

/**
 * Rotates encrypted API keys stored on `domain_integration.encrypted_api_key`.
 *
 * @param params - Rotation params for key material and execution mode.
 * @returns Batch counters for scanned/updated/failed rows.
 */
const rotateDomainIntegrationCiphertexts = async (params: {
  oldMasterKey: string;
  newMasterKey: string;
  dryRun: boolean;
  batchSize: number;
}): Promise<RotateBatchCounters> => {
  const counters: RotateBatchCounters = {
    scanned: 0,
    updated: 0,
    skippedPlaintext: 0,
    failed: 0,
  };
  let cursor: string | null = null;

  while (true) {
    const findArgs = {
      where: { encryptedApiKey: { not: null } },
      orderBy: { id: "asc" },
      take: params.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, key: true, encryptedApiKey: true },
    } satisfies Prisma.DomainIntegrationFindManyArgs;

    const rows = await prisma.domainIntegration.findMany(findArgs);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      counters.scanned += 1;
      const ciphertext = row.encryptedApiKey;
      if (!ciphertext) {
        continue;
      }
      try {
        const plaintext = decryptDomainIntegrationApiKeyWithFallback(
          ciphertext,
          params.newMasterKey,
          params.oldMasterKey,
        );
        const rewrapped = encryptDomainIntegrationApiKey(
          plaintext,
          params.newMasterKey,
        );
        if (!params.dryRun) {
          await prisma.domainIntegration.update({
            where: { id: row.id },
            data: { encryptedApiKey: rewrapped },
          });
        }
        counters.updated += 1;
      } catch {
        counters.failed += 1;
        throw new Error(
          `Failed to rotate domain integration "${row.key}" (${row.id})`,
        );
      }
    }

    cursor = rows[rows.length - 1]?.id ?? null;
  }

  return counters;
};

/**
 * Rotates encrypted secret variable values stored on `variable.value` where `is_secret=true`.
 *
 * @param params - Rotation params for key material and execution mode.
 * @returns Batch counters for scanned/updated/skipped/failed rows.
 */
const rotateSecretVariableCiphertexts = async (params: {
  oldMasterKey: string;
  newMasterKey: string;
  dryRun: boolean;
  batchSize: number;
}): Promise<RotateBatchCounters> => {
  const counters: RotateBatchCounters = {
    scanned: 0,
    updated: 0,
    skippedPlaintext: 0,
    failed: 0,
  };
  let cursor: string | null = null;

  while (true) {
    const findArgs = {
      where: { isSecret: true },
      orderBy: { id: "asc" },
      take: params.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, key: true, value: true },
    } satisfies Prisma.VariableFindManyArgs;
    const rows = await prisma.variable.findMany(findArgs);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      counters.scanned += 1;
      if (!isEncryptedSecretVariablePayload(row.value)) {
        counters.skippedPlaintext += 1;
        continue;
      }
      try {
        const plaintext = decryptSecretVariableValueWithFallback(
          row.value,
          params.newMasterKey,
          params.oldMasterKey,
        );
        const rewrapped = encryptSecretVariableValue(
          plaintext,
          params.newMasterKey,
        );
        if (!params.dryRun) {
          await prisma.variable.update({
            where: { id: row.id },
            data: { value: rewrapped },
          });
        }
        counters.updated += 1;
      } catch {
        counters.failed += 1;
        throw new Error(`Failed to rotate secret variable "${row.key}"`);
      }
    }

    cursor = rows[rows.length - 1]?.id ?? null;
  }

  return counters;
};

/**
 * Parses CLI args for the rotation script.
 *
 * @param argv - Process argv.
 * @returns Parsed rotation options.
 */
const parseCliArgs = (argv: string[]): RotateInternalKeyCiphertextsOptions => {
  const getFlagValue = (flag: string): string | undefined => {
    const index = argv.findIndex((arg) => arg === flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const oldMasterKey = getFlagValue("--old-master-key");
  const newMasterKey = getFlagValue("--new-master-key");
  const batchSizeRaw = getFlagValue("--batch-size");
  const batchSize =
    batchSizeRaw && batchSizeRaw.trim().length > 0
      ? Number.parseInt(batchSizeRaw, 10)
      : undefined;
  const dryRun = argv.includes("--dry-run");

  if (!oldMasterKey) {
    throw new Error("Missing required --old-master-key argument");
  }
  if (!newMasterKey) {
    throw new Error("Missing required --new-master-key argument");
  }

  return {
    oldMasterKey,
    newMasterKey,
    dryRun,
    batchSize,
  };
};

/**
 * CLI entrypoint for online zero-downtime internal key rotation rewrap.
 * Usage:
 * `pnpm --filter @hermes/orchestration-database rotate:internal-key-ciphertexts --old-master-key "<old>" --new-master-key "<new>" [--dry-run] [--batch-size 200]`
 */
export const main = async (): Promise<void> => {
  const options = parseCliArgs(process.argv);
  const result = await rotateInternalKeyCiphertexts(options);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun === true,
        batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
        ...result,
      },
      null,
      2,
    ),
  );
};

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(process.argv[1], "file://").href;

if (isDirectExecution) {
  void main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`rotate-internal-key-ciphertexts failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

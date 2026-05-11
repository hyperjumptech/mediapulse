import { parseArgs } from "node:util";

import { z } from "zod";

const valuesSchema = z
  .object({
    "client-id": z.string().min(1),
    "client-secret": z.string().min(1),
    "tenant-id": z.string().min(1),
    "user-id": z.string().min(1).optional(),
  })
  .strict();

export type OutlookTestLibCliCredentials = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  userId: string;
};

const usageLines = [
  "Usage: pnpm --filter @mediapulse/outlook-inbox run test:lib -- \\",
  "  --client-id=<azure-app-id> \\",
  "  --client-secret=<secret> \\",
  "  --tenant-id=<tenant-id> \\",
  "  [--user-id=<mailbox-upn-or-id>]   (default: me)",
].join("\n");

/**
 * Parses CLI arguments for `script/test-lib.ts` (Graph client credentials only).
 *
 * @param rawArgv - Typically `process.argv.slice(2)` when run under `tsx`.
 * @returns Credential fields for `createOutlookInboxClient`.
 * @throws Error when flags are missing, invalid, or unknown (strict parsing).
 */
export const parseOutlookTestLibCli = (
  rawArgv: readonly string[],
): OutlookTestLibCliCredentials => {
  try {
    const { values } = parseArgs({
      args: [...rawArgv],
      options: {
        "client-id": { type: "string" },
        "client-secret": { type: "string" },
        "tenant-id": { type: "string" },
        "user-id": { type: "string" },
      },
      strict: true,
    });
    const parsed = valuesSchema.parse(values);
    return {
      clientId: parsed["client-id"],
      clientSecret: parsed["client-secret"],
      tenantId: parsed["tenant-id"],
      userId: parsed["user-id"] ?? "me",
    };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${detail}\n\n${usageLines}`, { cause });
  }
};

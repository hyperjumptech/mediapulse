/**
 * Creates a pending domain integration for local dev (same storage as the dashboard wizard):
 * generates a secret, stores ciphertext + SHA-256 hash on encrypted_payload, sets status pending.
 *
 * Loads env from `apps/hermes/dashboard/.env.local` (symlink to `packages/hermes/env/.env` after bootstrap).
 *
 * Usage:
 *   pnpm seed-local-domain-integration <admin-email> [integration-id] [display-name]
 *
 * Defaults: integration id `mediapulse`, display-name `Local dev Mediapulse`.
 *
 * Machine-readable footer (for dev-setup-local.sh):
 *   PLAIN_API_KEY=<secret>
 *   INTEGRATION_ID=<integration-id>
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run ./dev-bootstrap.sh first.`);
  process.exit(1);
}
config({ path: envPath });

const DEFAULT_INTEGRATION_ID = "mediapulse";
const DEFAULT_NAME = "Local dev Mediapulse";

/**
 * CLI entry: ensure admin user exists in argv, then create or skip domain integration seed.
 */
async function main(): Promise<void> {
  const { env } = await import("@hermes/env");
  const email = process.argv[2];
  const integrationId = process.argv[3] ?? DEFAULT_INTEGRATION_ID;
  const displayName = process.argv[4] ?? DEFAULT_NAME;

  if (!email) {
    console.error(
      "Usage: pnpm seed-local-domain-integration <admin-email> [integration-id] [display-name]",
    );
    process.exit(1);
  }

  if (!env.HERMES_INTERNAL_API_KEY?.trim()) {
    console.error(
      "HERMES_INTERNAL_API_KEY is empty. Set it in packages/hermes/env/.env (dev-setup-local.sh does this before this step).",
    );
    process.exit(1);
  }

  const prismaClient = await import("@hermes/orchestration-database").then(
    (m) => m.prisma,
  );

  const user = await prismaClient.user.findUnique({
    where: { email },
  });
  if (!user) {
    console.error(`User not found: ${email}. Run create:admin first.`);
    await prismaClient.$disconnect();
    process.exit(1);
  }

  const existing = await prismaClient.domainIntegration.findUnique({
    where: { integrationId },
  });
  if (existing) {
    console.warn(
      `Domain integration "${integrationId}" already exists (id=${existing.id}).`,
    );
    console.warn(
      "Cannot print the API key again. Keep DOMAIN_INTEGRATION_API_KEY in your env or delete the domain_integration row and re-run dev-setup.",
    );
    console.log(`SKIP_PLAINTEXT=1`);
    console.log(`INTEGRATION_ID=${integrationId}`);
    await prismaClient.$disconnect();
    process.exit(0);
  }

  const { createPendingDomainIntegration } =
    await import("../lib/domain-integrations");
  const result = await createPendingDomainIntegration(
    {
      integrationId,
      name: displayName,
      userId: user.id,
    },
    prismaClient,
    env.HERMES_INTERNAL_API_KEY,
  );

  console.log("");
  console.log(
    "Domain integration created (pending until domain-api registers).",
  );
  console.log(`  id: ${result.id}`);
  console.log(`  integrationId: ${result.integrationId}`);
  console.log(`  name: ${result.name}`);
  console.log("");
  console.log("Raw API key (store securely, shown once):");
  console.log(result.apiKeyPlaintext);
  console.log("");
  console.log(`PLAIN_API_KEY=${result.apiKeyPlaintext}`);
  console.log(`INTEGRATION_ID=${result.integrationId}`);

  await prismaClient.$disconnect();
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

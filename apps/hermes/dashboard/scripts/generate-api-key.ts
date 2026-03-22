/**
 * Generates an API key for a user and stores its hash in the database.
 * The raw key is printed once; store it securely. Use only for development or automation.
 *
 * Usage: pnpm generate-api-key <email> <name> [--purpose scheduler|general|run_pipeline|domain_integration]
 * Example: pnpm generate-api-key dev@example.com "Local dev domain" --purpose domain_integration
 */
import { config } from "dotenv";
import fs from "fs";
import * as crypto from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";

const VALID_PURPOSES = [
  "general",
  "scheduler",
  "run_pipeline",
  "domain_integration",
] as const;

function parseArgs(argv: string[]): {
  email: string;
  name: string;
  purpose: (typeof VALID_PURPOSES)[number];
} {
  const args = argv.slice(2).filter((a) => !a.startsWith("--"));
  const purposeArg =
    argv.find((a) => a.startsWith("--purpose="))?.split("=")[1] ??
    argv[argv.indexOf("--purpose") + 1];
  const purpose =
    purposeArg &&
    VALID_PURPOSES.includes(purposeArg as (typeof VALID_PURPOSES)[number])
      ? (purposeArg as (typeof VALID_PURPOSES)[number])
      : "general";
  return {
    email: args[0] ?? "",
    name: args[1] ?? "",
    purpose,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("The .env.local file does not exist in the app root.");
  process.exit(1);
}
config({ path: envPath });

console.log(`Loading environment variables from ${envPath}`);

async function main() {
  const { email, name, purpose } = parseArgs(process.argv);

  if (!email || !name) {
    console.error(
      "Usage: pnpm generate-api-key <email> <name> [--purpose scheduler|general|run_pipeline|domain_integration]",
    );
    process.exit(1);
  }

  const prismaClient =
    await import("@hermes/orchestration-database/client").then(
      (m) => m.prismaClient,
    );

  const user = await prismaClient.user.findUnique({
    where: { email },
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const rawKey = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prismaClient.aPIKey.create({
    data: {
      name,
      key: hash,
      userId: user.id,
      purpose,
    },
  });

  console.log(`API key created: ${apiKey.id}`);
  console.log(`Name: ${name}`);
  console.log(`Purpose: ${purpose}`);
  console.log(`User: ${user.email}`);
  console.log("");
  console.log("Raw key (store securely, shown once):");
  console.log(rawKey);

  await prismaClient.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

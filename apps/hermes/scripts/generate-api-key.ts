/**
 * Generates an API key for a user and stores its hash in the database.
 * The raw key is printed once; store it securely. Use only for development or automation.
 *
 * Usage: pnpm dlx tsx scripts/generate-api-key.ts <email> <name>
 * Example: pnpm dlx tsx scripts/generate-api-key.ts dev@example.com "CI key"
 */
import { config } from "dotenv";
import fs from "fs";
import * as crypto from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";

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
  const [email, name] = process.argv.slice(2);

  if (!email || !name) {
    console.error(
      "Usage: pnpm dlx tsx scripts/generate-api-key.ts <email> <name>",
    );
    process.exit(1);
  }

  const prismaClient = await import("@workspace/database/client").then(
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
    },
  });

  console.log(`API key created: ${apiKey.id}`);
  console.log(`Name: ${name}`);
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

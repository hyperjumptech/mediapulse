/**
 * This is a script to create a user in the database. Use it only for development purposes.
 * Usage: pnpm dlx tsx scripts/create-user.ts <email> <password>
 * Example: pnpm dlx tsx scripts/create-user.ts kevin@hyperjump.tech password123
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env.local");

if (!fs.existsSync(envPath)) {
  console.error("The .env.local file does not exist in the root directory.");
  process.exit(1);
}
config({ path: envPath });

const { logger } = await import("@workspace/logger");

logger.info(`Loading environment variables from ${envPath}`);

import bcrypt from "bcrypt";

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    logger.error("Usage: npx tsx scripts/create-user.ts <email> <password>");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const prismaClient = await import("@workspace/database/client").then(
    (module) => module.prismaClient,
  );

  const user = await prismaClient.user.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: {
      email,
      name: email.split("@")[0] ?? email,
      password: hashedPassword,
    },
  });

  logger.info(
    { email: user.email, userId: user.id },
    "User saved successfully.",
  );

  prismaClient.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  logger.error({ err: error }, "Error creating user");
  process.exit(1);
});

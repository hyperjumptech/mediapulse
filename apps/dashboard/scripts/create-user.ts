/**
 * This is a script to create a user in the database. Use it only for development purposes.
 * Usage: npx tsx scripts/create-user.ts <email> <password>
 * Example: npx tsx scripts/create-user.ts kevin@hyperjump.tech password123
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

console.log(`Loading environment variables from ${envPath}`);

import bcrypt from "bcrypt";

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password>");
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

  console.log(`User ${user.email} (${user.id}) saved successfully.`);

  prismaClient.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

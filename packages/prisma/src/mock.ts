import { UserRole } from "../generated/prisma/enums";
import { prisma } from "./index";

async function main() {
  const admin = await prisma.user.create({
    data: {
      name: "Kevin",
      email: "kevin@hyperjump.tech",
      password: "password123",
      role: UserRole.ADMIN,
    },
  });

  console.log("Created admin:");
  console.log(admin);

  const user1 = await prisma.user.create({
    data: {
      name: "Budhi",
      email: "budhi@hyperjump.tech",
      password: "password123",
      role: UserRole.USER,
    },
  });

  console.log("Created user1:");
  console.log(user1);

  const user2 = await prisma.user.create({
    data: {
      name: "Sinta",
      email: "sinta@hyperjump.tech",
      password: "password123",
      role: UserRole.USER,
    },
  });

  console.log("Created user2:");
  console.log(user2);

  // API Keys
  const apiKey = await prisma.aPIKey.create({
    data: {
      userId: admin.id,
      key: "api-key-1",
    },
  });

  console.log("Created API key:");
  console.log(apiKey);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.log(e);
    await prisma.$disconnect();
    process.exit(1);
  });

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

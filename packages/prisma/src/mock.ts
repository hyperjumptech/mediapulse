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

  const ticker = await prisma.ticker.create({
    data: {
      symbol: "AAPL",
      name: "Apple Inc.",
    },
  });

  const searchQueries = await Promise.all([
    prisma.searchQuery.create({
      data: {
        tickerId: ticker.id,
        text: "AAPL stock price",
      },
    }),
    prisma.searchQuery.create({
      data: {
        tickerId: ticker.id,
        text: "Apple iPhone sales",
      },
    }),
    prisma.searchQuery.create({
      data: {
        tickerId: ticker.id,
        text: "Tim Cook Apple CEO",
      },
    }),
  ]);

  console.log("Created search queries:");
  console.log(searchQueries);
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

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

  const pipeline = await prisma.pipeline.create({
    data: {
      name: "Demo Pipeline",
      description: "This is a demo pipeline",
    },
  });

  console.log("Created pipeline:");
  console.log(pipeline);

  const pipelineSteps = await prisma.pipelineStep.createMany({
    data: [
      {
        order: 1,
        agentId: "data-collection",
        agentVersion: "1.0.0",
        pipelineId: pipeline.id,
      },
      {
        order: 2,
        agentId: "content-generation",
        agentVersion: "1.0.0",
        pipelineId: pipeline.id,
      },
      {
        order: 3,
        agentId: "delivery",
        agentVersion: "1.0.0",
        pipelineId: pipeline.id,
      },
    ],
  });

  console.log("Created pipeline steps:");
  console.log(pipelineSteps);
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

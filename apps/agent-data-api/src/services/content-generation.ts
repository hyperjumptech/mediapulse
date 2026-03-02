import { prisma } from "@workspace/database";
import { logger } from "@workspace/logger";

import type { PostContentGenerationBody } from "../schemas/content-generation.js";

export async function getDataSourcesForTicker(tickerId: string) {
  return prisma.dataSource.findMany({
    where: { tickerId },
  });
}

export async function createNewsletter(data: PostContentGenerationBody) {
  const newsletter = await prisma.newsletter.create({
    data: {
      subject: data.subject,
      description: data.description ?? null,
      content: data.content,
      tickerId: data.tickerId,
    },
  });
  logger.info(
    { tickerId: data.tickerId, newsletterId: newsletter.id },
    "Created newsletter for ticker",
  );
  return newsletter;
}

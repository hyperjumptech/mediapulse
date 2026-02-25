import { prisma } from "@workspace/database";

import type { PostContentGenerationBody } from "../schemas/content-generation.js";

export async function getDataSourcesForTicker(tickerId: string) {
  return prisma.dataSource.findMany({
    where: { tickerId },
  });
}

export async function createNewsletter(data: PostContentGenerationBody) {
  return prisma.newsletter.create({
    data: {
      subject: data.subject,
      description: data.description,
      content: data.content,
      tickerId: data.tickerId,
    },
  });
}

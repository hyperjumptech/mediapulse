import { prisma } from "@workspace/database";

import type { GetDataCollectionQuery } from "../schemas/data-collection.js";
import type { PostDataCollectionBody } from "../schemas/data-collection.js";

export async function getSearchQueries(query: GetDataCollectionQuery) {
  return prisma.searchQuery.findMany({
    where: {
      tickerId: query.tickerId,
      ...(query.start &&
        query.end && {
          createdAt: {
            gte: new Date(query.start),
            lte: new Date(query.end),
          },
        }),
    },
  });
}

export async function createDataSources(data: PostDataCollectionBody) {
  return prisma.dataSource.createMany({ data });
}

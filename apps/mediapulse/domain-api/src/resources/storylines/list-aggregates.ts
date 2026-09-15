import type { prisma } from "@mediapulse/database";

export type BuildStorylineCitationCountsDeps = {
  development: Pick<typeof prisma.development, "findMany">;
};

export async function buildStorylineCitationCounts(
  storylineIds: readonly string[],
  deps: BuildStorylineCitationCountsDeps,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (storylineIds.length === 0) {
    return counts;
  }

  const rows = await deps.development.findMany({
    where: { storylineId: { in: [...storylineIds] } },
    select: {
      storylineId: true,
      _count: { select: { citations: true } },
    },
  });

  for (const storylineId of storylineIds) {
    counts.set(storylineId, 0);
  }
  for (const row of rows) {
    counts.set(
      row.storylineId,
      (counts.get(row.storylineId) ?? 0) + row._count.citations,
    );
  }

  return counts;
}

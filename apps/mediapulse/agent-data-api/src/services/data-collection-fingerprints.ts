import type { Prisma } from "@mediapulse/database";
import {
  DATA_COLLECTION_FINGERPRINT_HEAD_CHARS,
  DATA_COLLECTION_MAX_FINGERPRINTS,
  type SourceFingerprint,
} from "@workspace/agent-data-api-contract";

type DataSourceDb = Pick<
  typeof import("@mediapulse/database").prisma.dataSource,
  "findMany"
>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type GetRecentSourceFingerprintsParams = {
  tickerId: string;
  windowDays: number;
};

export type GetRecentSourceFingerprintsDeps = {
  dataSource: DataSourceDb;
  now?: Date;
};

/**
 * Returns recent source titles and head snippets for client-side semantic dedupe embedding.
 *
 * @param params - Ticker and lookback window in days.
 * @param deps - Prisma delegate and optional clock.
 */
export async function getRecentSourceFingerprints(
  params: GetRecentSourceFingerprintsParams,
  deps: GetRecentSourceFingerprintsDeps,
): Promise<SourceFingerprint[]> {
  const now = deps.now ?? new Date();
  const windowStart = new Date(now.getTime() - params.windowDays * MS_PER_DAY);

  const findArgs = {
    where: {
      tickerId: params.tickerId,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "desc" as const },
    take: DATA_COLLECTION_MAX_FINGERPRINTS,
    select: { id: true, title: true, description: true, content: true },
  } satisfies Prisma.DataSourceFindManyArgs;

  const rows = await deps.dataSource.findMany(findArgs);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    headSnippet: (row.description ?? row.content ?? "").slice(
      0,
      DATA_COLLECTION_FINGERPRINT_HEAD_CHARS,
    ),
  }));
}

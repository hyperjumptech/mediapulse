import type { Prisma } from "@mediapulse/database";
import type { prisma } from "@mediapulse/database";
import { deriveRegistrableDomain } from "@workspace/utils";

import { isPrismaUniqueViolation } from "./is-prisma-unique-violation.js";

type DataSourceCreateDelegate = Pick<typeof prisma.dataSource, "create">;

/**
 * Inserts data source rows one at a time, skipping canonical-url duplicates.
 *
 * `createMany({ skipDuplicates: true })` cannot target PostgreSQL partial unique
 * indexes on `canonical_url`, so concurrent page-collection runs would 500.
 *
 * @param rows - Rows to insert.
 * @param deps - `dataSource.create` delegate.
 * @returns Count of rows actually inserted.
 */
export const insertDataSourcesIdempotently = async (
  rows: Prisma.DataSourceCreateManyInput[],
  deps: { dataSource: DataSourceCreateDelegate },
): Promise<number> => {
  const { dataSource } = deps;
  let inserted = 0;

  for (const row of rows) {
    const registrableDomain = deriveRegistrableDomain(
      row.canonicalUrl || row.url,
    );

    try {
      await dataSource.create({
        data: {
          ...row,
          ...(registrableDomain ? { registrableDomain } : {}),
        },
      });
      inserted += 1;
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        continue;
      }
      throw error;
    }
  }

  return inserted;
};

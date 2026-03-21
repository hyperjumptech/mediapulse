import { prisma } from "@workspace/orchestration-database";

type Db = typeof prisma;

export type RegisteredDatabaseRow = {
  id: string;
  name: string;
  connectionStringMasked: string;
  allowlistedTables: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const CONNECTION_MASK = "••••••";

/**
 * Masks username/password query details in a connection string for UI display.
 *
 * @param connectionString - Raw connection string.
 * @returns Masked and safe-to-display string.
 */
export const maskConnectionString = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    const username = url.username ? CONNECTION_MASK : "";
    const password = url.password ? CONNECTION_MASK : "";
    const auth =
      username && password
        ? `${username}:${password}@`
        : username
          ? `${username}@`
          : "";
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${auth}${url.hostname}${port}${url.pathname}${url.search}`;
  } catch {
    return CONNECTION_MASK;
  }
};

/**
 * Returns all registered expansion databases ordered by name.
 *
 * @param db - Prisma client.
 * @returns Registered database rows for dashboard display.
 */
export const getRegisteredDatabases = async (
  db: Db = prisma,
): Promise<RegisteredDatabaseRow[]> => {
  const rows = await db.registeredDatabase.findMany({
    orderBy: { name: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    connectionStringMasked: CONNECTION_MASK,
    allowlistedTables: Array.isArray(row.allowlistedTables)
      ? row.allowlistedTables.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    isActive: row.isActive,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

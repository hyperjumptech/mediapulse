import { PrismaClient } from "../client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@workspace/env";
import { getDatabaseParams } from "./utils";

/**
 * Creates a Prisma client configured for Mediapulse domain storage.
 *
 * @param url - Optional explicit database URL override.
 * @returns Prisma client with schema-aware pg adapter.
 */
export class PrismaClientWithSchema extends PrismaClient {
  private currentSchema = "public";

  constructor(url?: string) {
    const connectionString =
      url ?? env.MEDIAPULSE_DATABASE_URL ?? env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Connection string is required");
    }

    const { host, port, database, user, password, ssl, schema } =
      getDatabaseParams(connectionString, env.DATABASE_CERT_BASE64);

    const pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    const adapter = new PrismaPg(pool, {
      schema,
    });

    super({
      adapter,
      log: ["info", "warn", "error"],
      errorFormat: "minimal",
    });
  }

  /**
   * Switches active schema for subsequent statements on this client.
   *
   * @param schema - Schema name.
   */
  async useSchema(schema: string) {
    this.currentSchema = schema;
    await this.$disconnect();
    await this.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await this.$executeRawUnsafe(`SET search_path TO "${schema}"`);
  }

  /**
   * Returns current schema name.
   *
   * @returns Schema name.
   */
  getCurrentSchema() {
    return this.currentSchema;
  }
}

declare global {
  var prismaClientMediapulseDomain: PrismaClientWithSchema | undefined;
}

if (!globalThis.prismaClientMediapulseDomain) {
  globalThis.prismaClientMediapulseDomain = new PrismaClientWithSchema();
}

const prismaClient = globalThis.prismaClientMediapulseDomain;

export { prismaClient, prismaClient as prisma };

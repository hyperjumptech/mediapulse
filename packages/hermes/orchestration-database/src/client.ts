import { PrismaClient } from "../client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@hermes/env";
import { getDatabaseParams } from "./utils";

/**
 * Creates a Prisma client configured for orchestration storage.
 *
 * @param url - Optional explicit database URL override.
 * @returns Prisma client with schema-aware pg adapter.
 */
export class PrismaClientWithSchema extends PrismaClient {
  private currentSchema = "public";

  constructor(url?: string) {
    const connectionString = url ?? env.ORCHESTRATION_DATABASE_URL;
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
  var prismaClientOrchestration: PrismaClientWithSchema | undefined;
}

if (!globalThis.prismaClientOrchestration) {
  globalThis.prismaClientOrchestration = new PrismaClientWithSchema();
}

const prismaClient = globalThis.prismaClientOrchestration;

export { prismaClient, prismaClient as prisma };

import { PrismaClient } from "../client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@workspace/env";
import { getDatabaseParams } from "./utils";

/**
 * This class is used to create a Prisma client with a schema. It also supports SSL connections.
 * To support SSL connections, you need to set the DATABASE_CERT_BASE64 environment variable with the base64 encoded certificate by following these steps:
 *
 * 1. Download the certificate
 * 2. Run `base64 -i the-certificate.crt -o the-certificate-base64.txt` to generate the base64 encoded certificate
 * 3. Set the DATABASE_CERT_BASE64 environment variable with the content of the-certificate-base64.txt
 * 4. Make sure the postgres url contains `sslmode=require`
 *
 * Example of the postgres url:
 * postgres://root:root@localhost:5432/mediapulse?schema=public&sslmode=require
 */
export class PrismaClientWithSchema extends PrismaClient {
  private currentSchema: string = "public";

  constructor(url?: string) {
    const connectionString = url || env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Connection string is required");
    }

    const { host, port, database, user, password, ssl, schema } =
      getDatabaseParams(connectionString, env.DATABASE_CERT_BASE64);

    // Create Pool with SSL configuration
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

  async useSchema(schema: string) {
    this.currentSchema = schema;

    await this.$disconnect();

    await this.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // Set schema for all queries in this connection
    await this.$executeRawUnsafe(`SET search_path TO "${schema}"`);
  }

  getCurrentSchema() {
    return this.currentSchema;
  }
}

let prismaClient: PrismaClientWithSchema;

if (!(global as any).prismaClientMediapulse) {
  (global as any).prismaClientMediapulse = new PrismaClientWithSchema();
}

prismaClient = (global as any).prismaClientMediapulse;

export { prismaClient };

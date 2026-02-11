import "dotenv/config";
import { defineConfig } from "prisma/config";
import { env } from "@workspace/env";

export default defineConfig({
  datasource: {
    // This should be the direct connection to the database. Don't use the pooling connection.
    url: env.DATABASE_URL,
  },
});

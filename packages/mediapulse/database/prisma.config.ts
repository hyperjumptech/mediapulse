/* eslint-disable strict-env/no-process-env -- Prisma CLI loads this module before app T3 env; only the DB URL is read here. */
// cursor-pr-review-disable: env-variables
import "dotenv/config";
import { defineConfig } from "prisma/config";

const url =
  process.env.MEDIAPULSE_DATABASE_URL ??
  "postgresql://mediapulse:mediapulse@localhost:5432/mediapulse?schema=mediapulse";

export default defineConfig({
  datasource: {
    // This should be the direct connection to the database. Don't use the pooling connection.
    url,
  },
});

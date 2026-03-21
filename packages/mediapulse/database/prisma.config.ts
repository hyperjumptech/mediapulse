import "./load-root-env";
import { defineConfig } from "prisma/config";
import { env } from "@workspace/env";

export default defineConfig({
  datasource: {
    // This should be the direct connection to the database. Don't use the pooling connection.
    url:
      env.MEDIAPULSE_DATABASE_URL ??
      env.DATABASE_URL ??
      "postgresql://mediapulse:mediapulse@localhost:5432/mediapulse?schema=mediapulse",
  },
});

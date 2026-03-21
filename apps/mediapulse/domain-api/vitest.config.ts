import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      MEDIAPULSE_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    },
  },
});

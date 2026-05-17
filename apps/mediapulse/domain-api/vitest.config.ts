import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      MEDIAPULSE_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
      // @mediapulse/env validates on import (e.g. via @mediapulse/database); CI and Vitest do not
      // reliably load symlinked package .env before the module graph initializes.
      AGENT_AUTH_API_URL: "http://127.0.0.1:8080",
      HERMES_API_URL: "http://127.0.0.1:3001",
      MEDIAPULSE_API_URL: "http://127.0.0.1:8090",
      DOMAIN_INTEGRATION_ID: "mediapulse",
      DOMAIN_INTEGRATION_API_KEY: "vitest-placeholder-domain-integration-key",
      UNSUBSCRIBE_SECRET: "vitest-placeholder-unsubscribe-secret",
    },
  },
});

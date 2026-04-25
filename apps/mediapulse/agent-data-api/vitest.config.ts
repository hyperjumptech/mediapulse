import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      MEDIAPULSE_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
      AGENT_AUTH_API_URL: "http://127.0.0.1:8080",
      DOMAIN_INTEGRATION_ID: "mediapulse",
      DOMAIN_INTEGRATION_API_KEY: "vitest-placeholder-domain-integration-key",
    },
  },
});

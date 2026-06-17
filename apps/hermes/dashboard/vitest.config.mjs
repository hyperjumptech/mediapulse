import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    // Defaults so importing @hermes/env validates in CI.
    env: {
      ORCHESTRATION_DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/hermes?schema=orchestration",
      TEMP_ADMIN_USERNAME: "test",
      TEMP_ADMIN_PASSWORD: "testtest",
      HERMES_DATA_SOURCE_MAX_TAKE: "5000",
      HERMES_INTERNAL_API_KEY: "test-hermes-internal-api-key",
      HERMES_MCP_API_KEY_PEPPER: "test-mcp-api-key-pepper",
    },
    testTimeout: 10_000,
    hookTimeout: 30_000,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    reporters: ["default", "json"],
    outputFile: "./coverage/test-output.json",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "app/**/*.ts",
        "app/**/*.tsx",
        "components/**/*.ts",
        "components/**/*.tsx",
        "lib/**/*.ts",
      ],
      exclude: [
        "node_modules",
        "dist",
        "build",
        "public",
        "public/**/*",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
      ],
    },
  },
  plugins: [react(), tsconfigPaths()],
});

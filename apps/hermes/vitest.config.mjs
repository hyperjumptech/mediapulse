import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
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
  plugins: [tsconfigPaths()],
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      "@workspace/env": path.resolve(__dirname, "../env/src/index.ts"),
      "@workspace/logger": path.resolve(__dirname, "../logger/src/index.ts"),
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // React Email's <Tailwind> compiles the Tailwind engine on its first render,
    // which is slow on cold/shared CI runners. Every email renders through the
    // shared shell, so give those render tests headroom over the 5s default.
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
    },
  },
});

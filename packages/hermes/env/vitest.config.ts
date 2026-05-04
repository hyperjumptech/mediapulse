// cursor-pr-review-disable: typescript-javascript-standards

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["scripts/**/*.test.ts"],
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(packageDir, "..", "..", "..");

export default defineConfig({
  root: repoRoot,
  test: {
    include: ["scripts/lib/**/*.test.ts"],
  },
});

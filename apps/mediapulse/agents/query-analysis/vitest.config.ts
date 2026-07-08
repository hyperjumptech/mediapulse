import { readFileSync } from "node:fs";

import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "raw-txt-loader",
      enforce: "pre",
      load(id: string) {
        const path = id.split("?")[0] ?? id;
        if (path.endsWith(".txt")) {
          const content = readFileSync(path, "utf8");
          return `export default ${JSON.stringify(content)};`;
        }
        return null;
      },
    },
  ],
  test: {
    environment: "node",
    globals: true,
  },
});

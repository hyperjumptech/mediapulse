/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("pipelines cancel-manual-execution route.ts", () => {
  it("re-exports the generated route entrypoint", () => {
    const routePath = join(__dirname, "route.ts");
    expect(readFileSync(routePath, "utf8")).toContain(
      'export * from "./.generated/route"',
    );
  });
});

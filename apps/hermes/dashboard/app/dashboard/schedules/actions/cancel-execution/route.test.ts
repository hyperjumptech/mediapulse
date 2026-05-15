/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("schedules cancel-execution route.ts", () => {
  it("exports POST via createHermesDashboardRoute for mutation enforcement", () => {
    const routePath = join(__dirname, "route.ts");
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("createHermesDashboardRoute");
    expect(source).toContain("export const POST");
  });
});

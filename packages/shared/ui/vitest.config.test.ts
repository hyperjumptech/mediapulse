/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configDir = dirname(fileURLToPath(import.meta.url));
const configSource = readFileSync(join(configDir, "vitest.config.ts"), "utf8");

describe("vitest.config.ts", () => {
  it("declares jsdom, vitest-setup, test includes, and hook coverage", () => {
    // Assert
    expect(configSource).toContain('environment: "jsdom"');
    expect(configSource).toContain("./vitest-setup.ts");
    expect(configSource).toContain("vitest.config.test.ts");
    expect(configSource).toContain("src/hooks/use-sidebar-provider-state.ts");
  });
});

/** @vitest-environment node */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FEATURE_DIRECTORY = fileURLToPath(new URL(".", import.meta.url));

const DOMAIN_WORDS = /ticker|mediapulse/i;

const productionFiles = readdirSync(FEATURE_DIRECTORY).filter(
  (fileName) => /\.tsx?$/.test(fileName) && !/\.test\.tsx?$/.test(fileName),
);

describe("processed-urls feature", () => {
  it("has production files to check", () => {
    expect(productionFiles).toContain("page.tsx");
  });

  it.each(productionFiles)("keeps domain words out of %s", (fileName) => {
    const source = readFileSync(join(FEATURE_DIRECTORY, fileName), "utf8");

    expect(source).not.toMatch(DOMAIN_WORDS);
  });
});

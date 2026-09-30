import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HERMES_MUTATE_TOOL_SPECS } from "./mutate-tool-catalog.js";
import { HERMES_READ_TOOL_SPECS } from "./tool-catalog.js";

const PROFILE_TOOL_NAMES = [
  "hermes_list_profiles",
  "hermes_set_active_profile",
];

const readme = readFileSync(
  new URL("../../README.md", import.meta.url),
  "utf8",
);

const registeredToolNames = [
  ...HERMES_READ_TOOL_SPECS.map((spec) => spec.name),
  ...HERMES_MUTATE_TOOL_SPECS.map((spec) => spec.name),
  ...PROFILE_TOOL_NAMES,
];

describe("README tool tables", () => {
  it.each(registeredToolNames)("documents %s", (toolName) => {
    expect(readme).toContain(`\`${toolName}\``);
  });
});

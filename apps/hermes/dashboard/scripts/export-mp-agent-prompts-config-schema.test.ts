/** @vitest-environment node */
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MP_AGENT_PROMPT_EXPORT_AGENT_IDS,
  parseMpAgentPromptsExportArgs,
} from "./export-mp-agent-prompts-config-schema";

describe("parseMpAgentPromptsExportArgs", () => {
  it("parses a supported agent id and default output directory", () => {
    const argv = ["node", "script.ts", "article-analysis"];

    const result = parseMpAgentPromptsExportArgs(argv);

    expect(result.agentId).toBe("article-analysis");
    expect(result.outDir).toContain(
      "artifacts/ui-evidence/mp-agent-prompts-hermes/schemas",
    );
  });

  it("parses a custom output directory", () => {
    const customOut = "/tmp/schemas";
    const argv = ["node", "script.ts", "query-analysis", customOut];

    expect(parseMpAgentPromptsExportArgs(argv)).toEqual({
      agentId: "query-analysis",
      outDir: customOut,
    });
  });

  it("throws when agent id is missing or unknown", () => {
    expect(() => parseMpAgentPromptsExportArgs(["node", "script.ts"])).toThrow(
      /Usage:/,
    );
    expect(() =>
      parseMpAgentPromptsExportArgs(["node", "script.ts", "unknown-agent"]),
    ).toThrow(/Usage:/);
  });
});

describe("MP_AGENT_PROMPT_EXPORT_AGENT_IDS", () => {
  it("lists all supported agent ids", () => {
    expect(MP_AGENT_PROMPT_EXPORT_AGENT_IDS).toEqual(
      expect.arrayContaining([
        "article-analysis",
        "query-analysis",
        "content-generation",
      ]),
    );
    expect(MP_AGENT_PROMPT_EXPORT_AGENT_IDS).toHaveLength(3);
  });

  it("matches paths used by the Hermes dev fixture schemas", () => {
    const fixtureDir = path.join(
      "apps",
      "hermes",
      "dashboard",
      "app",
      "dev",
      "ui",
      "mp-agent-prompts-hermes",
      "schemas",
    );
    for (const agentId of MP_AGENT_PROMPT_EXPORT_AGENT_IDS) {
      expect(`${fixtureDir}/${agentId}.json`).toContain(agentId);
    }
  });
});

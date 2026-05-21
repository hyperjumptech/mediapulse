"use client";

import { useMemo, useState } from "react";

import { SchemaForm, type JsonSchema } from "@workspace/json-schema-form";
import { Label } from "@workspace/ui/components/label";

import { extractPromptsSchema } from "./extract-prompts-schema";
import articleAnalysisSchema from "./schemas/article-analysis.json";
import contentGenerationSchema from "./schemas/content-generation.json";
import queryAnalysisSchema from "./schemas/query-analysis.json";

const SCHEMA_BY_AGENT: Record<string, JsonSchema> = {
  "article-analysis": articleAnalysisSchema as JsonSchema,
  "query-analysis": queryAnalysisSchema as JsonSchema,
  "content-generation": contentGenerationSchema as JsonSchema,
};

const AGENT_LABELS: Record<string, string> = {
  "article-analysis": "article-analysis@1.0.0 (#478)",
  "query-analysis": "query-analysis@1.0.0 (#480)",
  "content-generation": "content-generation@1.0.0 (#481)",
};

const PROMPTS_SEED: Record<string, string> = {
  systemPrompt:
    "Optional system prompt override. Placeholders: {{entityTypesBlock}}, {{relationTypesBlock}}.",
  userPromptTemplate:
    "Optional user template. Placeholders: {{tickerId}}, {{title}}, {{articleContent}}.",
};

/** Seeds config so nested `prompts` fields render in SchemaForm. */
const seedConfigForAgent = (agentId: string): Record<string, unknown> => {
  const prompts = { ...PROMPTS_SEED };
  if (agentId === "article-analysis" || agentId === "query-analysis") {
    return { openaiApiKey: "sk-visual-proof" };
  }
  if (agentId === "content-generation") {
    return { openai: { apiKey: "sk-visual-proof" }, prompts };
  }
  return { prompts };
};

export type MpAgentPromptsFixtureFocus = "all" | "prompts";

export type MpAgentPromptsSchemaformFixtureProps = {
  agentId: string;
  /** When `prompts`, only the `prompts` sub-schema is shown (for visual proof). */
  focus?: MpAgentPromptsFixtureFocus;
};

/**
 * Dev-only Hermes SchemaForm preview for mp-agent-prompts config schemas.
 */
export const MpAgentPromptsSchemaformFixture = ({
  agentId,
  focus = "all",
}: MpAgentPromptsSchemaformFixtureProps) => {
  const fullSchema = SCHEMA_BY_AGENT[agentId];
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    seedConfigForAgent(agentId),
  );

  const label = useMemo(() => AGENT_LABELS[agentId] ?? agentId, [agentId]);
  const promptsSchema = fullSchema
    ? extractPromptsSchema(fullSchema)
    : undefined;
  const promptsOnly = focus === "prompts";

  const displaySchema = promptsOnly ? promptsSchema : fullSchema;
  const displayValue = promptsOnly
    ? ((config.prompts as Record<string, unknown> | undefined) ?? {})
    : config;
  const handleDisplayChange = (next: Record<string, unknown>) => {
    if (promptsOnly) {
      setConfig((prev) => ({ ...prev, prompts: next }));
      return;
    }
    setConfig(next);
  };

  if (!fullSchema) {
    return (
      <p className="text-destructive text-sm">
        Unknown agent &quot;{agentId}&quot;. Use article-analysis,
        query-analysis, or content-generation.
      </p>
    );
  }

  if (promptsOnly && !promptsSchema) {
    return (
      <p className="text-destructive text-sm">
        Agent &quot;{agentId}&quot; has no prompts sub-schema on this branch.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="space-y-1 border-b pb-4">
        <h1 className="text-lg font-semibold">
          Agent config — SchemaForm (dev)
        </h1>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-muted-foreground text-xs">
          {promptsOnly
            ? "Prompts section only (`focus=prompts`) — system and user fields use format textarea."
            : "Same @workspace/json-schema-form component as Hermes agent configs. Add ?focus=prompts for capture."}
        </p>
      </header>
      <div
        className="grid gap-1.5"
        data-visual-proof={promptsOnly ? "prompts" : undefined}
      >
        <Label className="mb-2">{promptsOnly ? "Prompts" : "Config"}</Label>
        {displaySchema ? (
          <SchemaForm
            schema={displaySchema}
            value={displayValue}
            onChange={handleDisplayChange}
          />
        ) : null}
      </div>
    </div>
  );
};

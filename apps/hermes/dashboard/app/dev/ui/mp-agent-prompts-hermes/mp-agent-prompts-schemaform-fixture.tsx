"use client";

import { useMemo, useState } from "react";

import { SchemaForm, type JsonSchema } from "@workspace/json-schema-form";
import { Label } from "@workspace/ui/components/label";

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

/** Seeds config so nested `prompts` fields are visible without scrolling past empty objects. */
const seedConfigForAgent = (agentId: string): Record<string, unknown> => {
  if (agentId === "article-analysis") {
    return {
      openaiApiKey: "sk-visual-proof",
      prompts: {
        systemPrompt: "",
        userPromptTemplate: "",
      },
    };
  }
  if (agentId === "query-analysis") {
    return {
      openaiApiKey: "sk-visual-proof",
      prompts: {
        systemPrompt: "",
        userPromptTemplate: "",
      },
    };
  }
  if (agentId === "content-generation") {
    return {
      openai: { apiKey: "sk-visual-proof" },
      prompts: {
        systemPrompt: "",
        userPromptTemplate: "",
      },
    };
  }
  return {};
};

export type MpAgentPromptsSchemaformFixtureProps = {
  agentId: string;
};

/**
 * Dev-only Hermes SchemaForm preview for mp-agent-prompts config schemas.
 */
export const MpAgentPromptsSchemaformFixture = ({
  agentId,
}: MpAgentPromptsSchemaformFixtureProps) => {
  const schema = SCHEMA_BY_AGENT[agentId];
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    seedConfigForAgent(agentId),
  );

  const label = useMemo(() => AGENT_LABELS[agentId] ?? agentId, [agentId]);

  if (!schema) {
    return (
      <p className="text-destructive text-sm">
        Unknown agent &quot;{agentId}&quot;. Use article-analysis,
        query-analysis, or content-generation.
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
          Same @workspace/json-schema-form component as Hermes agent configs.
          JSON schema exported via zodToJsonSchema on the feature branch.
        </p>
      </header>
      <div className="grid gap-1.5">
        <Label className="mb-2">Config</Label>
        <SchemaForm schema={schema} value={config} onChange={setConfig} />
      </div>
    </div>
  );
};

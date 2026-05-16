import { env } from "@hermes/env";
import { notFound } from "next/navigation";

import { validateWithJsonSchema } from "@/lib/validate-json-schema";

import queryAnalysisSchema from "../mp-agent-prompts-hermes/schemas/query-analysis.json";

const SAMPLE_CONFIG = {
  openaiApiKey: "{{OPENAI_API_KEY}}",
  openaiModel: "gpt-4o-mini",
  queryCount: 1,
  minDeterministicCount: 0,
  maxTokens: 256,
  prompts: {
    systemPrompt: "Query analysis system prompt for #521 visual proof.",
    userPromptTemplate: "User template with {{queryContextBlock}}.",
  },
};

/**
 * Dev-only page proving agent config validation accepts `format: "textarea"` (#521).
 */
const AgentConfigTextareaSaveDevPage = () => {
  if (env.NODE_ENV !== "development") {
    notFound();
  }

  const schema = queryAnalysisSchema as Record<string, unknown>;
  const result = validateWithJsonSchema(schema, SAMPLE_CONFIG);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-xl font-semibold">
        Agent config save validation (#521)
      </h1>
      <p className="text-muted-foreground text-sm">
        Uses the same <code>validateWithJsonSchema</code> as Hermes agent config
        create/update when saving.
      </p>
      {result.valid ? (
        <p
          className="text-sm text-green-700"
          role="status"
          data-testid="save-result"
        >
          Config saved successfully.
        </p>
      ) : (
        <p
          className="text-destructive text-sm"
          role="alert"
          data-testid="save-result"
        >
          Config validation failed: {result.errors.join("; ")}
        </p>
      )}
    </main>
  );
};

export default AgentConfigTextareaSaveDevPage;

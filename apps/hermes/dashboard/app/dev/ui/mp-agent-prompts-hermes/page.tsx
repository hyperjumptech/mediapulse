import { notFound } from "next/navigation";

import { MpAgentPromptsSchemaformFixture } from "./mp-agent-prompts-schemaform-fixture";

const ALLOWED_AGENTS = [
  "article-analysis",
  "query-analysis",
  "content-generation",
] as const;

type AllowedAgent = (typeof ALLOWED_AGENTS)[number];

const isAllowedAgent = (value: string): value is AllowedAgent =>
  (ALLOWED_AGENTS as readonly string[]).includes(value);

/**
 * Dev-only SchemaForm fixture for mp-agent-prompts Hermes visual proof (#478–482).
 * Unreachable in production builds.
 */
const MpAgentPromptsHermesDevPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }> | { agent?: string };
}) => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const resolved = await Promise.resolve(searchParams);
  const agentId = resolved.agent ?? "article-analysis";
  if (!isAllowedAgent(agentId)) {
    notFound();
  }

  return <MpAgentPromptsSchemaformFixture agentId={agentId} />;
};

export default MpAgentPromptsHermesDevPage;

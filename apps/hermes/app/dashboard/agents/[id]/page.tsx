import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentById } from "@/lib/agents";

import { AgentEditForm } from "./agent-edit-form";

/**
 * Normalizes Prisma JsonValue to a plain object for the endpoint textarea.
 */
function toEndpointObject(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Agent detail/edit page. Loads agent by id and renders edit form.
 */
const AgentEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  const endpointObj = toEndpointObject(agent.endpoint);
  const endpointJson =
    endpointObj === undefined || endpointObj === null
      ? "{}"
      : JSON.stringify(endpointObj, null, 2);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Edit agent: {agent.agentId}@{agent.agentVersion}
        </h1>
        <p className="text-muted-foreground">
          Update agent ID, version, description, endpoint (JSON), and active
          status.
        </p>
      </div>

      <AgentEditForm
        id={agent.id}
        initialAgentId={agent.agentId}
        initialAgentVersion={agent.agentVersion}
        initialDescription={agent.description ?? ""}
        initialEndpointJson={endpointJson}
        initialIsActive={agent.isActive}
      />
    </div>
  );
};

export default withAuthProtection(AgentEditPage);

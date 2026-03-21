import { useEffect, useMemo, useState } from "react";

export type StepForEditor = {
  id: string;
  agentId: string;
  agentVersion: string;
};

export type FetchAgentSchemas = (
  agentId: string,
  agentVersion: string,
) => Promise<{ inputSchema: unknown; configSchema: unknown } | null>;

const defaultFetchAgentSchemas: FetchAgentSchemas = async (
  agentId: string,
  agentVersion: string,
) => {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/${encodeURIComponent(agentVersion)}/schemas`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    inputSchema?: unknown;
    configSchema?: unknown;
  };
  return {
    inputSchema: data.inputSchema ?? null,
    configSchema: data.configSchema ?? null,
  };
};

const isObjectSchemaWithProperties = (schema: unknown): boolean =>
  schema != null &&
  typeof schema === "object" &&
  !Array.isArray(schema) &&
  (schema as { type?: string }).type === "object" &&
  (schema as { properties?: unknown }).properties != null;

export type StepEditorPanelState = {
  schemas: {
    inputSchema: Record<string, unknown> | null;
    configSchema: Record<string, unknown> | null;
  };
  schemaLoading: boolean;
  activeTab: "input" | "config";
  setActiveTab: (tab: "input" | "config") => void;
};

/**
 * Encapsulates schema loading, tab state, and reset-on-step-change for the step editor panel.
 *
 * @param selectedStep - The currently selected pipeline step, or null when none selected.
 * @param options - Optional: inject fetchAgentSchemas for tests (defaults to API fetch).
 * @returns Current schemas, loading flag, active tab, and setActiveTab.
 */
export const useStepEditorPanelState = (
  selectedStep: StepForEditor | null,
  options: { fetchAgentSchemas?: FetchAgentSchemas } = {},
): StepEditorPanelState => {
  const { fetchAgentSchemas = defaultFetchAgentSchemas } = useMemo(
    () => options,
    [options],
  );

  const [schemas, setSchemas] = useState<{
    inputSchema: Record<string, unknown> | null;
    configSchema: Record<string, unknown> | null;
  }>({ inputSchema: null, configSchema: null });
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "config">("input");
  const [lastStepId, setLastStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStep) {
      setLastStepId(null);
      return;
    }
    if (selectedStep.id !== lastStepId) {
      setLastStepId(selectedStep.id);
      setActiveTab("input");
    }
  }, [selectedStep, lastStepId]);

  useEffect(() => {
    if (!selectedStep) {
      setSchemas({ inputSchema: null, configSchema: null });
      return;
    }
    setSchemaLoading(true);
    fetchAgentSchemas(selectedStep.agentId, selectedStep.agentVersion)
      .then((result) => {
        if (!result) {
          setSchemas({ inputSchema: null, configSchema: null });
          return;
        }
        const inputSchema =
          isObjectSchemaWithProperties(result.inputSchema) &&
          typeof result.inputSchema === "object"
            ? (result.inputSchema as Record<string, unknown>)
            : null;
        const configSchema =
          isObjectSchemaWithProperties(result.configSchema) &&
          typeof result.configSchema === "object"
            ? (result.configSchema as Record<string, unknown>)
            : null;
        setSchemas({ inputSchema, configSchema });
      })
      .finally(() => setSchemaLoading(false));
  }, [selectedStep, fetchAgentSchemas]);

  return { schemas, schemaLoading, activeTab, setActiveTab };
};

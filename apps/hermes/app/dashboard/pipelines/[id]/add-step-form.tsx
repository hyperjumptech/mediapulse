"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

import { useFormAction } from "@/app/dashboard/pipelines/actions/add-step/.generated/use-form-action";
import { cn } from "@workspace/ui/lib/utils";
import type { AgentConfigSummary } from "@/lib/agent-configs";

type Agent = {
  id: string;
  agentId: string;
  agentVersion: string;
  description: string | null;
};

/**
 * Encapsulates add-step form state: selection, config, form action, and reset-on-success.
 */
const useAddStepFormState = (
  agents: Agent[],
  existingStepAgentKeys: string[],
  configsByAgentKey: Record<string, AgentConfigSummary[]>,
) => {
  const router = useRouter();
  const { FormWithAction, state, pending } = useFormAction();
  const [selected, setSelected] = useState<{
    agentId: string;
    agentVersion: string;
  } | null>(null);
  const [savedConfigId, setSavedConfigId] = useState<string | "">("");
  const [customConfigJson, setCustomConfigJson] = useState("{}");

  const availableAgents = useMemo(
    () =>
      agents.filter(
        (a) =>
          !existingStepAgentKeys.includes(`${a.agentId}@${a.agentVersion}`),
      ),
    [agents, existingStepAgentKeys],
  );

  const agentKey = selected
    ? `${selected.agentId}@${selected.agentVersion}`
    : "";
  const savedConfigs = agentKey ? (configsByAgentKey[agentKey] ?? []) : [];
  const useSavedConfig = savedConfigId !== "";

  const errorMessage = useMemo(() => {
    if (state && state.status === false) return state.message;
    return null;
  }, [state]);

  useEffect(() => {
    if (state && state.status === true) {
      setSelected(null);
      setSavedConfigId("");
      setCustomConfigJson("{}");
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    setSavedConfigId("");
  }, [agentKey]);

  return {
    FormWithAction,
    pending,
    errorMessage,
    selected,
    setSelected,
    savedConfigId,
    setSavedConfigId,
    customConfigJson,
    setCustomConfigJson,
    availableAgents,
    agentKey,
    savedConfigs,
    useSavedConfig,
  };
};

/**
 * Add step form: select agent, optional saved config or custom JSON config; submit to add-step.
 */
export const AddStepForm = ({
  pipelineId,
  agents,
  existingStepAgentKeys,
  configsByAgentKey,
}: {
  pipelineId: string;
  agents: Agent[];
  existingStepAgentKeys: string[];
  configsByAgentKey: Record<string, AgentConfigSummary[]>;
}) => {
  const {
    FormWithAction,
    pending,
    errorMessage,
    selected,
    setSelected,
    savedConfigId,
    setSavedConfigId,
    customConfigJson,
    setCustomConfigJson,
    availableAgents,
    agentKey,
    savedConfigs,
    useSavedConfig,
  } = useAddStepFormState(agents, existingStepAgentKeys, configsByAgentKey);

  return (
    <FormWithAction className="flex flex-col gap-2 mt-4">
      <input type="hidden" name="body.pipelineId" value={pipelineId} readOnly />
      <input
        type="hidden"
        name="body.agentId"
        value={selected?.agentId ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.agentVersion"
        value={selected?.agentVersion ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.agentConfigId"
        value={useSavedConfig ? savedConfigId : ""}
        readOnly
      />
      <input
        type="hidden"
        name="body.config"
        value={useSavedConfig ? "{}" : customConfigJson}
        readOnly
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="add-step-agent">Add agent</Label>
          <select
            id="add-step-agent"
            className={cn(
              "flex h-9 w-[280px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            value={agentKey}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setSelected(null);
                return;
              }
              const [agentId, agentVersion] = v.split("@");
              if (agentId && agentVersion) {
                setSelected({ agentId, agentVersion });
              }
            }}
            disabled={pending}
          >
            <option value="">Select an agent…</option>
            {availableAgents.map((a) => (
              <option key={a.id} value={`${a.agentId}@${a.agentVersion}`}>
                {a.agentId}@{a.agentVersion}
                {a.description ? ` — ${a.description}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={pending || !selected}
        >
          {pending ? "Adding…" : "Add step"}
        </Button>
      </div>
      {selected ? (
        <>
          {savedConfigs.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="add-step-saved-config">
                Saved config (optional)
              </Label>
              <select
                id="add-step-saved-config"
                className={cn(
                  "flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
                value={savedConfigId}
                onChange={(e) => setSavedConfigId(e.target.value)}
                disabled={pending}
              >
                <option value="">None (use custom below)</option>
                {savedConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.description ? ` — ${c.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!useSavedConfig ? (
            <div className="grid gap-1.5">
              <Label htmlFor="add-step-config">Config (JSON, optional)</Label>
              <textarea
                id="add-step-config"
                value={customConfigJson}
                onChange={(e) => setCustomConfigJson(e.target.value)}
                rows={3}
                disabled={pending}
                className={cn(
                  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow]",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                )}
                placeholder="{}"
              />
            </div>
          ) : null}
        </>
      ) : null}
      {availableAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All registered agents are already in this pipeline.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </FormWithAction>
  );
};

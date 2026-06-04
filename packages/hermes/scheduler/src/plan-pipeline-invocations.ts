import type { PrismaClient } from "@hermes/orchestration-database";
import {
  decryptSecretVariableValueWithFallback,
  isEncryptedSecretVariablePayload,
} from "@hermes/domain-integration-crypto";

import { AgentEndpointSchema } from "./invoke-agent";
import { substituteVariables } from "./substitute-variables";
import { validateWithJsonSchema } from "./validate-json-schema";
import type { ExpandStepInputs } from "./execute-schedule";
import type { EnqueueDiagnosticEntry } from "./enqueue-diagnostics";

export type PlannedInvocation = {
  pipelineStepId: string;
  agentId: string;
  agentVersion: string;
  endpointUrl: string;
  input: Record<string, unknown>;
  config: Record<string, unknown>;
  contract?: { brief: string; version: string };
};

export type PlanPipelineInvocationsResult = {
  waveList: PlannedInvocation[][];
  errors: EnqueueDiagnosticEntry[];
};

type PipelineStepForPlanning = {
  id: string;
  agentId: string;
  agentVersion: string;
  input?: unknown;
  config?: unknown;
  agentConfigId?: string | null;
  agentConfig?: { config: unknown } | null;
  agentContractId?: string | null;
  agentContract?: { brief: string; version: string } | null;
};

type PipelineForPlanning = {
  id: string;
  domainIntegrationId: string;
  steps: PipelineStepForPlanning[];
};

type PlanPipelineInvocationsArgs = {
  db: PrismaClient;
  pipeline: PipelineForPlanning;
  sourceId: string;
  expandStepInputs: ExpandStepInputs;
  variableSecretMasterKey?: string;
  variableSecretFallbackMasterKey?: string;
  requireHttpsAgentEndpoints?: boolean;
};

/**
 * Returns false when requireHttps is true and the URL is http with a host other than localhost/127.0.0.1.
 */
const isAllowedAgentEndpointUrl = (
  urlString: string,
  requireHttps: boolean,
): boolean => {
  if (!requireHttps) return true;
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:") return true;
    const hostname = url.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

/**
 * Plans agent invocations for all pipeline steps by resolving variables, validating schemas,
 * and expanding step inputs into one-or-many invocation payloads.
 */
export const planPipelineInvocations = async ({
  db,
  pipeline,
  sourceId,
  expandStepInputs,
  variableSecretMasterKey,
  variableSecretFallbackMasterKey,
  requireHttpsAgentEndpoints = false,
}: PlanPipelineInvocationsArgs): Promise<PlanPipelineInvocationsResult> => {
  const errors: EnqueueDiagnosticEntry[] = [];
  const variables = await db.variable.findMany({
    include: { encryptedPayload: true },
  });
  const variableMap = new Map<string, string>();
  for (const variable of variables) {
    if (!variable.isSecret) {
      variableMap.set(variable.key, variable.value);
      continue;
    }
    if (!variableSecretMasterKey) {
      throw new Error(
        "Secret variable substitution requires variableSecretMasterKey",
      );
    }
    const ciphertext = variable.encryptedPayload?.ciphertext;
    if (ciphertext == null || ciphertext === "") {
      throw new Error(
        `Secret variable "${variable.key}" is missing encryptedPayload.ciphertext`,
      );
    }
    if (!isEncryptedSecretVariablePayload(ciphertext)) {
      variableMap.set(variable.key, ciphertext);
      continue;
    }
    try {
      const plaintext = decryptSecretVariableValueWithFallback(
        ciphertext,
        variableSecretMasterKey,
        variableSecretFallbackMasterKey,
      );
      variableMap.set(variable.key, plaintext);
    } catch {
      throw new Error(
        `Failed to decrypt secret variable "${variable.key}" for invocation planning`,
      );
    }
  }
  const agentIds = [...new Set(pipeline.steps.map((step) => step.agentId))];
  const agents = await db.agentRegistry.findMany({
    where: {
      agentId: { in: agentIds },
      isActive: true,
      domainIntegrationId: pipeline.domainIntegrationId,
    },
  });
  const agentByKey = new Map(
    agents.map((agent) => [`${agent.agentId}:${agent.agentVersion}`, agent]),
  );
  const waveList: PlannedInvocation[][] = [];

  for (const step of pipeline.steps) {
    const stepJobs: PlannedInvocation[] = [];
    const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
    if (!agent) {
      errors.push({
        message: `Agent ${step.agentId}@${step.agentVersion} not found`,
        timestamp: new Date().toISOString(),
        phase: "planning",
        pipelineStepId: step.id,
      });
      continue;
    }

    const endpointResult = AgentEndpointSchema.safeParse(agent.endpoint);
    if (!endpointResult.success) {
      errors.push({
        message: `Invalid endpoint for ${step.agentId}: ${endpointResult.error.message}`,
        timestamp: new Date().toISOString(),
        phase: "planning",
        pipelineStepId: step.id,
      });
      continue;
    }
    if (
      !isAllowedAgentEndpointUrl(
        endpointResult.data.url,
        requireHttpsAgentEndpoints,
      )
    ) {
      errors.push({
        message: `Agent endpoint must use HTTPS (or localhost) for ${step.agentId}: ${endpointResult.data.url}`,
        timestamp: new Date().toISOString(),
        phase: "planning",
        pipelineStepId: step.id,
      });
      continue;
    }

    const rawInput =
      step.input != null &&
      typeof step.input === "object" &&
      !Array.isArray(step.input)
        ? (step.input as Record<string, unknown>)
        : {};
    const inputSubstituted = substituteVariables(
      rawInput,
      variableMap,
    ) as Record<string, unknown>;
    const inputSchema =
      agent.inputSchema != null && typeof agent.inputSchema === "object"
        ? (agent.inputSchema as Record<string, unknown>)
        : null;
    if (inputSchema) {
      const result = validateWithJsonSchema(inputSchema, inputSubstituted);
      if (!result.valid) {
        errors.push({
          message: `Step input invalid for ${step.agentId}@${step.agentVersion}: ${result.errors.join("; ")}`,
          timestamp: new Date().toISOString(),
          phase: "planning",
          pipelineStepId: step.id,
        });
        continue;
      }
    }

    let stepConfig: Record<string, unknown>;
    if (step.agentConfigId != null && step.agentConfig != null) {
      const referencedConfig = step.agentConfig.config;
      stepConfig =
        referencedConfig != null &&
        typeof referencedConfig === "object" &&
        !Array.isArray(referencedConfig)
          ? (referencedConfig as Record<string, unknown>)
          : {};
    } else {
      stepConfig =
        step.config != null &&
        typeof step.config === "object" &&
        !Array.isArray(step.config)
          ? (step.config as Record<string, unknown>)
          : {};
    }
    stepConfig = substituteVariables(stepConfig, variableMap) as Record<
      string,
      unknown
    >;
    const configSchema =
      agent.configSchema != null && typeof agent.configSchema === "object"
        ? (agent.configSchema as Record<string, unknown>)
        : null;
    if (configSchema) {
      const result = validateWithJsonSchema(configSchema, stepConfig);
      if (!result.valid) {
        errors.push({
          message: `Step config invalid for ${step.agentId}@${step.agentVersion}: ${result.errors.join("; ")}`,
          timestamp: new Date().toISOString(),
          phase: "planning",
          pipelineStepId: step.id,
        });
        continue;
      }
    }

    const inputSets = await expandStepInputs({
      input: inputSubstituted,
      scheduleId: sourceId,
      pipelineId: pipeline.id,
      pipelineStepId: step.id,
      domainIntegrationId: pipeline.domainIntegrationId,
      orchDb: db,
    });
    const stepContract =
      step.agentContractId != null && step.agentContract != null
        ? step.agentContract
        : undefined;
    for (const inputSet of inputSets) {
      stepJobs.push({
        pipelineStepId: step.id,
        agentId: step.agentId,
        agentVersion: step.agentVersion,
        endpointUrl: endpointResult.data.url,
        input: inputSet as Record<string, unknown>,
        config: stepConfig,
        ...(stepContract !== undefined ? { contract: stepContract } : {}),
      });
    }
    if (stepJobs.length > 0) {
      waveList.push(stepJobs);
    }
  }

  return { waveList, errors };
};

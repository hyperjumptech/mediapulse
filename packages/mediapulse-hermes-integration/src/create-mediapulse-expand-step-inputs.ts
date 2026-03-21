import type { PrismaClient as MediapulsePrismaClient } from "@workspace/mediapulse-database";
import type { PrismaClient as OrchestrationPrismaClient } from "@workspace/orchestration-database";
import { expandDataSources } from "./expand-data-sources";

/**
 * Context passed from scheduler when expanding step inputs.
 */
export type ExpandStepInputsContext = {
  input: Record<string, unknown>;
  scheduleId: string;
  pipelineId: string;
  pipelineStepId: string;
  registeredDatabaseId: string | null;
  orchDb: OrchestrationPrismaClient;
};

export type ResolveAllowlistedTables = (
  registeredDatabaseId: string | null,
) => Promise<string[] | null>;

export type GetPrismaForExpansion = (
  registeredDatabaseId: string | null,
) => Promise<MediapulsePrismaClient>;

/**
 * Creates an input-expansion function that scheduler can inject.
 *
 * @param deps - Expansion collaborators.
 * @returns Function that maps a single step input into one-or-many invocation inputs.
 */
export const createMediapulseExpandStepInputs = (deps: {
  getPrismaForExpansion: GetPrismaForExpansion;
  resolveAllowlistedTables?: ResolveAllowlistedTables;
}) => {
  const { getPrismaForExpansion, resolveAllowlistedTables } = deps;

  return async (
    context: ExpandStepInputsContext,
  ): Promise<Record<string, unknown>[]> => {
    const expansionDb = await getPrismaForExpansion(
      context.registeredDatabaseId,
    );
    const allowlistedTables = resolveAllowlistedTables
      ? await resolveAllowlistedTables(context.registeredDatabaseId)
      : null;

    return expandDataSources(context.input, expansionDb, {
      allowlistedTables,
    });
  };
};

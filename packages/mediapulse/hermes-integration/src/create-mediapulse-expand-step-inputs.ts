import { DEFAULT_TAKE, MAX_TAKE } from "@hermes/step-input-syntax";
import type { PrismaClient as MediapulsePrismaClient } from "@mediapulse/database";
import type { PrismaClient as OrchestrationPrismaClient } from "@hermes/orchestration-database";
import { expandDataSources } from "./expand-data-sources";

/**
 * Context passed from scheduler when expanding step inputs.
 */
export type ExpandStepInputsContext = {
  input: Record<string, unknown>;
  scheduleId: string;
  pipelineId: string;
  pipelineStepId: string;
  orchDb: OrchestrationPrismaClient;
};
export type GetPrismaForExpansion = () => Promise<MediapulsePrismaClient>;

/**
 * Creates an input-expansion function that scheduler can inject.
 *
 * @param deps - Expansion collaborators.
 * @returns Function that maps a single step input into one-or-many invocation inputs.
 */
export const createMediapulseExpandStepInputs = (deps: {
  getPrismaForExpansion: GetPrismaForExpansion;
  /** Default take when omitted in the expression (defaults to `DEFAULT_TAKE` from syntax package). */
  defaultTake?: number;
  /** Hard cap on rows per expansion; must match validation / env (defaults to `MAX_TAKE` from syntax package). */
  maxTake?: number;
}) => {
  const {
    getPrismaForExpansion,
    defaultTake = DEFAULT_TAKE,
    maxTake = MAX_TAKE,
  } = deps;

  return async (
    context: ExpandStepInputsContext,
  ): Promise<Record<string, unknown>[]> => {
    const expansionDb = await getPrismaForExpansion();

    return expandDataSources(context.input, expansionDb, {
      defaultTake,
      maxTake,
    });
  };
};

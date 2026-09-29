import { prisma, type Prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { checkPipelineStepsComposition } from "@/lib/check-pipeline-steps-composition";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { withDashboardRevalidation } from "@/lib/revalidate-dashboard";

const OVERRIDES_MUST_BE_OBJECT =
  "Overrides must be a JSON object, for example {}";

const overridesSchema = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .transform((value, context): Record<string, unknown> => {
    if (typeof value !== "string") {
      return value;
    }
    if (value.trim() === "") {
      return {};
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      context.addIssue({ code: "custom", message: OVERRIDES_MUST_BE_OBJECT });

      return z.NEVER;
    }
    context.addIssue({ code: "custom", message: OVERRIDES_MUST_BE_OBJECT });

    return z.NEVER;
  });

const bodyValidator = z.object({
  pipelineId: z.guid(),
  stepId: z.guid(),
  targetPipelineId: z.guid(),
  input: overridesSchema,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type UpdatePipelineStepHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

export const createUpdatePipelineStepHandler = ({
  db = prisma,
}: {
  db?: typeof prisma;
} = {}): UpdatePipelineStepHandler => {
  return async (data) => {
    const { pipelineId, stepId, targetPipelineId, input } = data.body;
    const step = await db.pipelineStep.findFirst({
      where: { id: stepId, pipelineId },
      select: { kind: true },
    });
    if (!step) {
      return errorResponse("Step not found");
    }
    if (step.kind !== "pipeline") {
      return errorResponse(
        "This step runs an agent. Edit it as an agent step.",
      );
    }
    const check = await checkPipelineStepsComposition({
      db,
      pipelineId,
      proposeSteps: (currentSteps) =>
        currentSteps.map((currentStep) =>
          currentStep.id === stepId
            ? { ...currentStep, targetPipelineId, input }
            : currentStep,
        ),
    });
    if (!check.valid) {
      return errorResponse(check.message);
    }
    await db.pipelineStep.update({
      where: { id: stepId },
      data: { targetPipelineId, input: input as Prisma.InputJsonValue },
    });

    return successResponse({ ok: true as const });
  };
};

export const handler: UpdatePipelineStepHandler = withDashboardRevalidation(
  createUpdatePipelineStepHandler(),
);

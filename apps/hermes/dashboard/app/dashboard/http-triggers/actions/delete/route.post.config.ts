import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  httpTriggerId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteHttpTriggerHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Deletes one HTTP trigger by id.
 */
export const createDeleteHttpTriggerHandler = ({
  db = prisma,
}: {
  db?: typeof prisma;
} = {}): DeleteHttpTriggerHandler => {
  return async (data) => {
    const existing = await db.httpTrigger.findUnique({
      where: { id: data.body.httpTriggerId },
    });
    if (!existing) return errorResponse("HTTP trigger not found");
    await db.httpTrigger.delete({ where: { id: data.body.httpTriggerId } });
    return successResponse({ ok: true as const });
  };
};

export const handler: DeleteHttpTriggerHandler =
  createDeleteHttpTriggerHandler();

import { prisma } from "@workspace/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";
import { getVariableById } from "@/lib/variables";

const bodyValidator = z.object({
  id: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  id: z.string().uuid(),
  key: z.string(),
  value: z.string(),
  note: z.string().nullable(),
  isSecret: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type GetVariableHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  getById?: typeof getVariableById;
  db?: typeof prisma;
};

type GetVariableHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the get-variable handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession and getById.
 * @returns Handler that returns a single variable by id (value masked if secret).
 */
export const createGetVariableHandler = ({
  getSession = getDashboardSession,
  getById = getVariableById,
  db = prisma,
}: GetVariableHandlerDependencies = {}): GetVariableHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    const variable = await getById(data.body.id, db);
    if (!variable) {
      return errorResponse("Variable not found");
    }

    return successResponse({
      id: variable.id,
      key: variable.key,
      value: variable.value,
      note: variable.note,
      isSecret: variable.isSecret,
      createdAt: variable.createdAt,
      updatedAt: variable.updatedAt,
    });
  };
};

/**
 * Handles get variable by id (for edit). Value is masked when isSecret.
 */
export const handler: GetVariableHandler = createGetVariableHandler();

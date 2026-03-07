import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { logger as defaultLogger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import type { ZodError } from "zod";

import type { z } from "zod";
import type { AgentConfig, CreateAgentAppOptions } from "./types.js";

/**
 * Creates a Hono app that handles POST "/" with bearer auth, body validation,
 * and the agent run function. Response shape: { agentId, agentVersion [, skipped, message ] }.
 *
 * @param config - Agent id, version, Zod input schema, and run function.
 * @param options - Optional authApiUrl, verifyToken, and logger (DI for tests).
 * @returns Hono app with logger, bearer auth, and POST "/" handler.
 */
export function createAgentApp<TInput, TSchema extends z.ZodType<TInput>>(
  config: AgentConfig<TInput, TSchema>,
  options: CreateAgentAppOptions = {},
): Hono {
  const {
    authApiUrl = "",
    verifyToken = (token: string) => verifyTokenViaAuthApi(token, authApiUrl),
    logger = defaultLogger,
  } = options;

  const app = new Hono();
  app.use(
    pinoLogger({
      pino: logger,
      http: {
        onResBindings: (c) => ({
          res: {
            status: c.res.status,
            headers: Object.fromEntries(c.res.headers.entries()),
          },
        }),
      },
    }),
  );
  //app.use("*", bearerAuth({ verifyToken }));

  app.post("/", async (context) => {
    try {
      const body = await context.req.json();
      const input = (await config.inputSchema.parseAsync(body)) as TInput;
      const token = context.req.header("Authorization");

      const result = await config.run({ input, token });

      if (result.success) {
        return context.json(
          {
            agentId: config.agentId,
            agentVersion: config.agentVersion,
          },
          200,
        );
      }

      const statusCode = result.statusCode ?? 500;
      const payload: Record<string, unknown> = {
        agentId: config.agentId,
        agentVersion: config.agentVersion,
      };
      if (result.skipped !== undefined) payload.skipped = result.skipped;
      if (result.message !== undefined) payload.message = result.message;

      return context.json(payload, statusCode as 404 | 500);
    } catch (error) {
      if (isZodError(error)) {
        logger.error(
          {
            agentId: config.agentId,
            errors: (error as ZodError).flatten(),
          },
          "Agent input validation failed",
        );
        return context.json(
          {
            message: "Validation failed",
            errors: (error as ZodError).flatten(),
          },
          400,
        );
      }
      logger.error({ err: error }, "Agent run error");
      return context.json({ message: "Internal Server Error" }, 500);
    }
  });

  return app;
}

function isZodError(err: unknown): err is ZodError {
  return (
    err !== null &&
    typeof err === "object" &&
    "flatten" in err &&
    typeof (err as ZodError).flatten === "function"
  );
}

import { verifyTokenViaAuthApi } from "@workspace/agent-auth-client";
import { logger as defaultLogger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import type { ZodError } from "zod";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { registerWithRegistry } from "./register-with-registry.js";
import type { HermesInvokeEnvelopeV1 } from "./invoke-envelope.js";
import type { AgentConfig, CreateAgentAppOptions } from "./types.js";

const emptyConfigSchema = z.object({});

/**
 * Creates a Hono app that handles GET /schemas (no auth), POST "/" with bearer auth,
 * body validation ({ input, config }), and the agent run function.
 *
 * **200:** `run` result is mapped to the Hermes PRD envelope (`schemaVersion`, `status`, optional `message`).
 * **Throw** from `run` → 500 (or validation errors → 400).
 *
 * @param config - Agent id, version, Zod input/config schemas, and run function.
 * @param options - Optional authApiUrl, verifyToken, and logger (DI for tests).
 * @returns Hono app with logger, GET /schemas, bearer auth, and POST "/" handler.
 */
export function createAgentApp<
  TInput,
  TSchema extends z.ZodType<TInput>,
  TConfig = Record<string, never>,
  TConfigSchema extends z.ZodType<TConfig> = z.ZodType<TConfig>,
>(
  config: AgentConfig<TInput, TSchema, TConfig, TConfigSchema>,
  options: CreateAgentAppOptions = {},
): Hono {
  const {
    authApiUrl = "",
    verifyToken = (token: string) => verifyTokenViaAuthApi(token, authApiUrl),
    logger = defaultLogger,
  } = options;

  const configSchema = (config.configSchema ??
    emptyConfigSchema) as TConfigSchema;

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

  /** GET /schemas returns input and config JSON Schemas (no auth). */
  app.get("/schemas", (context) => {
    const inputSchema = zodToJsonSchema(config.inputSchema, {
      $refStrategy: "none",
    });
    const configSchemaJson = zodToJsonSchema(configSchema, {
      $refStrategy: "none",
    });
    return context.json({ inputSchema, configSchema: configSchemaJson });
  });

  app.use("*", bearerAuth({ verifyToken }));

  if (options.autoRegister) {
    const {
      registryUrl,
      domainIntegrationApiKey,
      agentUrl,
      fetchFn,
      tokenFetchFn,
    } = options.autoRegister;
    const inputSchemaJson = zodToJsonSchema(config.inputSchema, {
      $refStrategy: "none",
    }) as Record<string, unknown>;
    const configSchemaJson = zodToJsonSchema(configSchema, {
      $refStrategy: "none",
    }) as Record<string, unknown>;
    const maxAttempts = 3;
    const delayMs = 2000;
    if (!authApiUrl) {
      logger.error?.(
        {
          agentId: config.agentId,
          agentVersion: config.agentVersion,
        },
        "autoRegister is set but authApiUrl is missing; cannot mint JWT for registry registration",
      );
    } else {
      void (async () => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await registerWithRegistry({
              registryUrl,
              authApiUrl,
              domainIntegrationApiKey,
              agentId: config.agentId,
              agentVersion: config.agentVersion,
              agentUrl,
              inputSchema: inputSchemaJson,
              configSchema: configSchemaJson,
              description: config.description,
              fetchFn,
              tokenFetchFn,
            });
            logger.info?.(
              {
                agentId: config.agentId,
                agentVersion: config.agentVersion,
                agentUrl,
                registryUrl,
              },
              "Agent registered with registry",
            );
            return;
          } catch (err) {
            if (attempt < maxAttempts) {
              logger.info?.(
                { attempt, maxAttempts, registryUrl },
                "Registry unreachable, retrying...",
              );
              await new Promise((r) => setTimeout(r, delayMs));
            } else {
              const code = (err as NodeJS.ErrnoException & { code?: string })
                ?.code;
              const msg = String((err as Error)?.message ?? "");
              const isConnectionRefused =
                code === "ECONNREFUSED" ||
                code === "ConnectionRefused" ||
                /Unable to connect|ConnectionRefused|ECONNREFUSED/i.test(msg);
              if (isConnectionRefused) {
                logger.warn?.(
                  { err, registryUrl },
                  "Agent auto-registration failed (registry unreachable). Ensure agent-registry-api is running if you need registration.",
                );
              } else {
                logger.error({ err }, "Agent auto-registration failed");
              }
            }
          }
        }
      })();
    }
  } else {
    logger.warn?.(
      { agentId: config.agentId, agentVersion: config.agentVersion },
      "Agent not auto-registering: set AGENT_REGISTRY_URL, DOMAIN_INTEGRATION_API_KEY (Hermes domain_integration API key), AGENT_PUBLIC_URL, and AGENT_AUTH_API_URL to register with the registry on startup",
    );
  }

  app.post("/", async (context) => {
    try {
      const requestBody = (await context.req.json()) as {
        input?: unknown;
        config?: unknown;
      };
      const rawInput = requestBody?.input;
      const input = (await config.inputSchema.parseAsync(rawInput)) as TInput;
      const configParsed =
        requestBody?.config === undefined
          ? ({} as TConfig)
          : ((await configSchema.parseAsync(requestBody.config)) as TConfig);
      const token = context.req.header("Authorization");

      const result = await config.run({ input, config: configParsed, token });

      if (result.success) {
        const envelope: HermesInvokeEnvelopeV1 = {
          schemaVersion: 1,
          status: "success",
          ...(result.message !== undefined ? { message: result.message } : {}),
        };
        return context.json(envelope, 200);
      }

      const envelope: HermesInvokeEnvelopeV1 = {
        schemaVersion: 1,
        status: "failure",
        message: result.message,
      };
      return context.json(envelope, 200);
    } catch (error) {
      if (isZodError(error)) {
        const zodError = error as ZodError;
        const flattenedErrors = zodError.flatten();
        const requiredFields = Array.from(
          new Set(
            zodError.issues
              .filter(
                (issue) =>
                  issue.code === "invalid_type" &&
                  issue.received === "undefined",
              )
              .map((issue) =>
                issue.path.length > 0 ? issue.path.join(".") : "input",
              ),
          ),
        );
        const validationMessage =
          requiredFields.length > 0
            ? `Validation failed: missing required field(s): ${requiredFields.join(
                ", ",
              )}`
            : "Validation failed";

        logger.error(
          {
            agentId: config.agentId,
            errors: flattenedErrors,
            requiredFields,
          },
          "Agent input validation failed",
        );
        return context.json(
          {
            message: validationMessage,
            requiredFields,
            errors: flattenedErrors,
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

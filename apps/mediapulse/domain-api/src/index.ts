import {
  domainHealthResponseSchema,
  expandStepInputsRequestSchema,
  previewExpansionRequestSchema,
  registerDomainIntegrationRequestSchema,
} from "@hermes/domain-contract";
import { MAX_TAKE, parseDataSourceString } from "@hermes/step-input-syntax";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";
import {
  expandDataSources,
  expandSingleDataSource,
} from "@mediapulse/hermes-integration";
import { prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { z } from "zod";

const app = new Hono();
const api = app.basePath("/v1");

api.use(
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

if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
  api.use(
    "*",
    bearerAuth({
      verifyToken: (token) => token === env.DOMAIN_INTEGRATION_AUTH_TOKEN,
    }),
  );
}

api.get("/health", (c) => {
  const response = domainHealthResponseSchema.parse({
    ok: true,
    service: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    version: env.DOMAIN_INTEGRATION_VERSION,
  });
  return c.json(response);
});

api.post("/preview-expansion", async (c) => {
  const parsedBody = previewExpansionRequestSchema.safeParse(
    await c.req.json(),
  );
  if (!parsedBody.success) {
    return c.json({ success: false, error: "Invalid request body" }, 400);
  }

  const parsed = parseDataSourceString(parsedBody.data.expansionString);
  if (!parsed) {
    return c.json(
      {
        success: false,
        error:
          "Invalid format. Expected db:table:field?options (e.g. where.key=value, distinct, take, orderBy)",
      },
      400,
    );
  }

  const values = await expandSingleDataSource(parsed, prisma, {
    maxTake: env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
  });
  if (values === null) {
    return c.json(
      {
        success: false,
        error: `Unknown or unsupported table: ${parsed.table}`,
      },
      400,
    );
  }

  return c.json({ success: true, values });
});

api.post("/expand-step-inputs", async (c) => {
  const parsedBody = expandStepInputsRequestSchema.safeParse(
    await c.req.json(),
  );
  if (!parsedBody.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const expandedInputs = await expandDataSources(
    parsedBody.data.input,
    prisma,
    {
      defaultTake: parsedBody.data.defaultTake,
      maxTake:
        parsedBody.data.maxTake ?? env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
    },
  );

  return c.json({ expandedInputs });
});

/**
 * Registers this domain integration with Hermes.
 *
 * @returns Promise that resolves once registration call completes.
 */
const registerWithHermes = async (): Promise<void> => {
  if (
    !env.HERMES_API_URL ||
    !env.DOMAIN_INTEGRATION_REGISTRATION_API_KEY ||
    !env.MEDIAPULSE_API_URL
  ) {
    logger.info(
      "Skipping Hermes domain integration registration (missing HERMES_API_URL, DOMAIN_INTEGRATION_REGISTRATION_API_KEY, or MEDIAPULSE_API_URL)",
    );
    return;
  }

  const requestBody = registerDomainIntegrationRequestSchema.parse({
    key: env.DOMAIN_INTEGRATION_KEY ?? "mediapulse",
    name: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    baseUrl: env.MEDIAPULSE_API_URL,
    version: env.DOMAIN_INTEGRATION_VERSION,
    capabilities: ["expand-step-inputs", "preview-expansion"],
  });

  const response = await fetch(
    `${env.HERMES_API_URL.replace(/\/$/, "")}/api/domain-integrations/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DOMAIN_INTEGRATION_REGISTRATION_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const body = z
      .unknown()
      .catch(undefined)
      .parse(await response.json());
    logger.error(
      { status: response.status, body },
      "Domain integration registration failed",
    );
    return;
  }

  logger.info("Domain integration registered successfully");
};

void registerWithHermes();

export default {
  port: env.PORT ?? 8090,
  fetch: api.fetch,
};

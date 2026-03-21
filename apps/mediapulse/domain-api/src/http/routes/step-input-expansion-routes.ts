import {
  expandStepInputsRequestSchema,
  previewExpansionRequestSchema,
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
import { STEP_INPUT_DOMAIN_API_PATHS } from "../../hermes-dashboard/paths";
import { truncatePreviewExpansionError } from "../../lib/preview-expansion-error";

/**
 * Hermes pipeline integration: expand `db:` step inputs and preview a single expansion.
 */
export const stepInputExpansionRoutes = new Hono();

stepInputExpansionRoutes.post(
  STEP_INPUT_DOMAIN_API_PATHS.previewExpansion,
  async (c) => {
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

    try {
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
    } catch (e) {
      logger.error({ err: e }, "preview-expansion failed");
      const raw = e instanceof Error ? e.message : String(e);
      return c.json(
        {
          success: false,
          error: truncatePreviewExpansionError(raw),
        },
        400,
      );
    }
  },
);

stepInputExpansionRoutes.post(
  STEP_INPUT_DOMAIN_API_PATHS.expandStepInputs,
  async (c) => {
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
          parsedBody.data.maxTake ??
          env.HERMES_DATA_SOURCE_MAX_TAKE ??
          MAX_TAKE,
      },
    );

    return c.json({ expandedInputs });
  },
);

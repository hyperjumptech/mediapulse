/**
 * Zod write bodies and Hermes JSON Schemas for search-query-set CRUD forms.
 */

import { queryAnalysisPostQuerySchema } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import {
  hermesFormJsonSchemaFromZod,
  mergeHermesObjectFormProperties,
} from "../../lib/hermes-form-json-schema-from-zod";

const queriesArraySchema = z.array(queryAnalysisPostQuerySchema).min(1);

const strategySnapshotSchema = z.record(z.string(), z.unknown());

/** Shared scalar fields for create and update (queries parsed separately). */
const searchQuerySetScalarsSchema = z.object({
  generationSource: z.string().trim().min(1),
  isActive: z.boolean(),
  agentJobId: z.string().trim().min(1).optional().or(z.literal("")),
});

/** Validated create body after JSON fields are parsed to objects/arrays. */
export const searchQuerySetCreateBodySchema = searchQuerySetScalarsSchema
  .extend({
    tickerId: z.string().uuid(),
    strategySnapshot: strategySnapshotSchema,
    queries: queriesArraySchema,
  })
  .strict();

/** Validated update body; `tickerId` is immutable. */
export const searchQuerySetUpdateBodySchema = searchQuerySetScalarsSchema
  .extend({
    strategySnapshot: strategySnapshotSchema,
    queries: queriesArraySchema.optional(),
  })
  .strict();

const jsonTextareaProperty = (
  title: string,
  description: string,
): Record<string, unknown> => ({
  type: "string",
  title,
  description,
  format: "textarea",
});

const createScalarsJsonSchema = hermesFormJsonSchemaFromZod(
  searchQuerySetScalarsSchema.extend({
    tickerId: z.string().uuid(),
  }),
);

/** Hermes `createSchema` with JSON textarea fields for snapshot and queries. */
export const searchQuerySetCreateFormJsonSchema =
  mergeHermesObjectFormProperties(createScalarsJsonSchema, {
    strategySnapshot: jsonTextareaProperty(
      "Strategy snapshot",
      "JSON object persisted on the set (agent config snapshot or manual metadata).",
    ),
    queries: jsonTextareaProperty(
      "Queries",
      'JSON array of objects: [{ "text": "...", "intent": "breaking"|"kg_change"|"fundamental", "rank": 1 }, ...]',
    ),
  });

const updateScalarsJsonSchema = hermesFormJsonSchemaFromZod(
  searchQuerySetScalarsSchema,
);

/** Hermes `updateSchema`; omit `tickerId` (immutable). */
export const searchQuerySetUpdateFormJsonSchema =
  mergeHermesObjectFormProperties(updateScalarsJsonSchema, {
    strategySnapshot: jsonTextareaProperty(
      "Strategy snapshot",
      "JSON object persisted on the set.",
    ),
    queries: jsonTextareaProperty(
      "Queries",
      "Optional JSON array to replace all queries in the set. Same shape as create. Omit to leave queries unchanged.",
    ),
  });

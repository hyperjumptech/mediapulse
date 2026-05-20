/**
 * Declares entity-relations table-v1 custom actions (manifest rows + Hono handlers).
 */

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { prisma } from "@mediapulse/database";
import type { Handler } from "hono";
import { z } from "zod";

/** Confirm token required in the POST body for reset-all. */
export const entityRelationsResetAllConfirmToken =
  "DELETE_ALL_ENTITY_RELATIONS" as const;

const entityRelationsResetAllBodySchema = z
  .object({
    confirm: z.literal(entityRelationsResetAllConfirmToken),
  })
  .strict();

/**
 * One entity-relations table-v1 custom action: Hermes manifest row plus handler.
 */
export type EntityRelationsTableV1CustomActionDefinition = {
  manifest: DashboardPageCustomAction;
  handler: Handler;
};

/** Allowed custom-action slugs for the entity-relations table. */
export type EntityRelationsTableV1CustomActionId = "reset-all";

type EntityRelationsTableV1CustomActionRegistryValue = Omit<
  DashboardPageCustomAction,
  "id" | "path"
> & {
  handler: Handler;
};

/**
 * Deletes every row in `entity_relation` after the client sends the confirm token.
 */
const handleEntityRelationsResetAllPost: Handler = async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const parsed = entityRelationsResetAllBodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const result = await prisma.entityRelation.deleteMany({});
  return c.json({ deleted: result.count });
};

const entityRelationsTableV1CustomActionRegistry = {
  "reset-all": {
    label: "Reset all relations",
    description:
      "Permanently deletes every entity relation in the knowledge graph. This cannot be undone.",
    ui: "danger-confirm",
    method: "POST",
    confirmMessage:
      "Delete ALL entity relations? This removes every edge in the knowledge graph.",
    confirmToken: entityRelationsResetAllConfirmToken,
    handler: handleEntityRelationsResetAllPost,
  },
} satisfies Record<
  EntityRelationsTableV1CustomActionId,
  EntityRelationsTableV1CustomActionRegistryValue
>;

/**
 * Ordered list derived from the registry for manifest and route wiring.
 */
export const entityRelationsTableV1CustomActions = (
  [...Object.entries(entityRelationsTableV1CustomActionRegistry)] as [
    EntityRelationsTableV1CustomActionId,
    EntityRelationsTableV1CustomActionRegistryValue,
  ][]
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, row]): EntityRelationsTableV1CustomActionDefinition => {
    const { handler, ...manifestRest } = row;
    return {
      manifest: {
        id,
        ...manifestRest,
        path: `/${id}`,
      } satisfies DashboardPageCustomAction,
      handler,
    };
  }) satisfies readonly EntityRelationsTableV1CustomActionDefinition[];

/** Manifest `customActions` slice for {@link entityRelationsDashboardPage}. */
export const entityRelationsCustomActionsForManifest =
  entityRelationsTableV1CustomActions.map((entry) => entry.manifest);

/** Route registrations for {@link registerTableV1CustomActionRoutes}. */
export const entityRelationsTableV1CustomActionRegistrations =
  entityRelationsTableV1CustomActions.map((entry) => ({
    path: entry.manifest.path,
    method: entry.manifest.method,
    handler: entry.handler,
  }));

import {
  camelCaseResourceKeyToPathSegment,
  type AgentDataApiFlatManifest,
  type AgentDataApiResourceKey,
} from "@workspace/agent-data-api-contract";
import { Hono, type Context } from "hono";

type RouteHandler = (context: Context) => Promise<Response>;

export type AgentDataApiHandlers = {
  [K in AgentDataApiResourceKey]: {
    get?: AgentDataApiFlatManifest[K] extends { get: NonNullable<unknown> }
      ? RouteHandler
      : never;
    post?: AgentDataApiFlatManifest[K] extends { post: NonNullable<unknown> }
      ? RouteHandler
      : never;
  };
};

/**
 * Registers all GET and POST agent-data-api routes from a shared manifest.
 *
 * @param api - Hono instance already mounted under the API base path.
 * @param manifest - Contract manifest that describes resources and verbs.
 * @param handlers - Route handler map keyed by manifest resource key.
 * @returns The same Hono instance for chaining.
 */
export const registerAgentDataApiRoutes = (
  api: Hono,
  manifest: AgentDataApiFlatManifest,
  handlers: AgentDataApiHandlers,
): Hono => {
  const resourceKeys = Object.keys(manifest) as AgentDataApiResourceKey[];

  for (const resourceKey of resourceKeys) {
    const routeConfig = manifest[resourceKey];
    const routeHandlers = handlers[resourceKey];
    const segment =
      "pathSegment" in routeConfig &&
      typeof routeConfig.pathSegment === "string"
        ? routeConfig.pathSegment
        : camelCaseResourceKeyToPathSegment(String(resourceKey));

    if ("get" in routeConfig && routeConfig.get && routeHandlers.get) {
      api.get(segment, routeHandlers.get);
    }

    if ("post" in routeConfig && routeConfig.post && routeHandlers.post) {
      api.post(segment, routeHandlers.post);
    }
  }

  return api;
};

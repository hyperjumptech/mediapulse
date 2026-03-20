import {
  camelCaseResourceKeyToPathSegment,
  type AgentDataApiManifest,
  type AgentDataApiResourceKey,
} from "@workspace/agent-data-api-contract";
import { Hono, type Context } from "hono";

type RouteHandler = (context: Context) => Promise<Response>;

export type AgentDataApiHandlers = {
  [K in AgentDataApiResourceKey]: {
    get?: AgentDataApiManifest[K]["get"] extends undefined
      ? never
      : RouteHandler;
    post?: AgentDataApiManifest[K]["post"] extends undefined
      ? never
      : RouteHandler;
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
  manifest: AgentDataApiManifest,
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

    if (routeConfig.get && routeHandlers.get) {
      api.get(segment, routeHandlers.get);
    }

    if (routeConfig.post && routeHandlers.post) {
      api.post(segment, routeHandlers.post);
    }
  }

  return api;
};

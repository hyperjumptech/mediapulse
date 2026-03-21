import type { Hono } from "hono";
import type { Handler } from "hono";

/** HTTP verbs supported for table-v1 custom actions in the domain API. */
export type TableV1CustomActionMethod = "GET" | "POST";

/**
 * One custom action to mount on a resource Hono app (path is relative to that app).
 */
export type TableV1CustomActionRegistration = {
  readonly path: string;
  readonly method: TableV1CustomActionMethod;
  readonly handler: Handler;
};

/**
 * Mounts table-v1 custom action routes on a Hono app using the same paths/methods
 * advertised in the dashboard manifest.
 *
 * @param app - Resource router (e.g. tickers) mounted under the manifest `apiPrefix`.
 * @param registrations - Pairs of method, path, and handler; must be unique per method+path.
 * @throws Error when a path does not start with `/`, or when method+path duplicates.
 */
export const registerTableV1CustomActionRoutes = (
  app: Hono,
  registrations: readonly TableV1CustomActionRegistration[],
): void => {
  const seen = new Set<string>();
  for (const registration of registrations) {
    if (!registration.path.startsWith("/")) {
      throw new Error(
        `Table-v1 custom action path must start with "/": ${registration.path}`,
      );
    }
    const dedupeKey = `${registration.method} ${registration.path}`;
    if (seen.has(dedupeKey)) {
      throw new Error(`Duplicate table-v1 custom action route: ${dedupeKey}`);
    }
    seen.add(dedupeKey);
    if (registration.method === "POST") {
      app.post(registration.path, registration.handler);
    } else {
      app.get(registration.path, registration.handler);
    }
  }
};

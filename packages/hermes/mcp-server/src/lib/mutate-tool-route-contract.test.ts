import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { readRouteConfigContract } from "../test-utils/route-config-body-keys.js";
import { HERMES_MUTATE_TOOL_SPECS } from "./mutate-tool-catalog.js";
import { LOCAL_ONLY_FIELDS } from "./mutate-tool-spec.js";
import { HERMES_READ_TOOL_SPECS } from "./tool-catalog.js";

const DASHBOARD_DIRECTORY = new URL(
  "../../../../../apps/hermes/dashboard/",
  import.meta.url,
);

type ActionRouteSpec = {
  name: string;
  pathTemplate: string;
  inputSchema: z.ZodRawShape;
  expectedUserGuard: string;
};

const mutationRouteSpecs: ActionRouteSpec[] = HERMES_MUTATE_TOOL_SPECS.map(
  (spec) => ({
    name: spec.name,
    pathTemplate: spec.pathTemplate,
    inputSchema: spec.inputSchema,
    expectedUserGuard: "requireMutationDashboardPrincipalForRoute",
  }),
);

const postReadRouteSpecs: ActionRouteSpec[] = HERMES_READ_TOOL_SPECS.filter(
  (spec) => spec.method === "POST",
).map((spec) => ({
  name: spec.name,
  pathTemplate: spec.pathTemplate,
  inputSchema: spec.inputSchema,
  expectedUserGuard: "requireDashboardPrincipalForRoute",
}));

const actionRouteSpecs = [...mutationRouteSpecs, ...postReadRouteSpecs];

const routeFileUrl = (pathTemplate: string, fileName: string): URL =>
  new URL(`app${pathTemplate}/${fileName}`, DASHBOARD_DIRECTORY);

const readRouteContract = (spec: ActionRouteSpec) => {
  const configUrl = routeFileUrl(spec.pathTemplate, "route.post.config.ts");

  return readRouteConfigContract(
    configUrl.pathname,
    readFileSync(configUrl, "utf8"),
  );
};

const bodyFieldNames = (spec: ActionRouteSpec): string[] =>
  Object.keys(spec.inputSchema).filter(
    (key) => !LOCAL_ONLY_FIELDS.includes(key),
  );

const acceptsMissingValue = (schema: z.core.$ZodType | undefined): boolean =>
  schema === undefined || z.safeParse(schema, undefined).success;

describe("mutation tools and dashboard action routes", () => {
  it.each(actionRouteSpecs)(
    "$name posts to a dashboard action route",
    (spec) => {
      const configUrl = routeFileUrl(spec.pathTemplate, "route.post.config.ts");
      const routeUrl = routeFileUrl(spec.pathTemplate, "route.ts");

      const configExists = existsSync(configUrl);
      const routeExists = existsSync(routeUrl);

      expect(configExists, configUrl.pathname).toBe(true);
      expect(routeExists, routeUrl.pathname).toBe(true);
      expect(readFileSync(routeUrl, "utf8")).toContain(
        "createHermesDashboardRoute(",
      );
    },
  );

  it.each(actionRouteSpecs)(
    "$name uses the route guard that accepts API keys",
    (spec) => {
      const contract = readRouteContract(spec);

      expect(contract.userGuard, spec.pathTemplate).toBe(
        spec.expectedUserGuard,
      );
    },
  );

  it.each(actionRouteSpecs)(
    "$name sends only body keys its route reads",
    (spec) => {
      const routeKeys = new Set(
        readRouteContract(spec).bodyKeys.map((key) => key.name),
      );

      const unknownKeys = bodyFieldNames(spec).filter(
        (key) => !routeKeys.has(key),
      );

      expect(unknownKeys, spec.pathTemplate).toEqual([]);
    },
  );

  it.each(actionRouteSpecs)(
    "$name requires every body key its route requires",
    (spec) => {
      const requiredRouteKeys = readRouteContract(spec)
        .bodyKeys.filter((key) => !key.optional)
        .map((key) => key.name);

      const keysOptionalInTool = requiredRouteKeys.filter((key) =>
        acceptsMissingValue(spec.inputSchema[key]),
      );

      expect(keysOptionalInTool, spec.pathTemplate).toEqual([]);
    },
  );
});

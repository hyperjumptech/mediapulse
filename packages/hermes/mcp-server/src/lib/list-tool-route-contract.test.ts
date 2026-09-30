import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  HERMES_READ_TOOL_SPECS,
  type HermesReadToolSpec,
} from "./tool-catalog.js";

const DASHBOARD_DIRECTORY = new URL(
  "../../../../../apps/hermes/dashboard/",
  import.meta.url,
);

const SHARED_LIST_PARSER_PATH = new URL(
  "lib/parse-api-page-params.ts",
  DASHBOARD_DIRECTORY,
);

const SHARED_LIST_PARSER_CALL =
  /\bparseApi(?:ListParams|ListQuery|PageParams)\(/;

const routeFileUrl = (pathTemplate: string): URL => {
  const routeDirectory = pathTemplate.replace(/\{([^}]+)\}/g, "[$1]");

  return new URL(`app${routeDirectory}/route.ts`, DASHBOARD_DIRECTORY);
};

const readRouteSource = (spec: HermesReadToolSpec): string =>
  readFileSync(routeFileUrl(spec.pathTemplate), "utf8");

const readsQueryKey = (source: string, key: string): boolean =>
  source.includes(`searchParams.get("${key}")`);

const exportsHandler = (source: string, method: string): boolean =>
  new RegExp(
    `export\\s+(?:const\\s+${method}\\s*=|async\\s+function\\s+${method}\\b)`,
  ).test(source);

const apiReadSpecs = HERMES_READ_TOOL_SPECS.filter((spec) =>
  spec.pathTemplate.startsWith("/api/"),
);

const specsWithQueryKeys = HERMES_READ_TOOL_SPECS.filter(
  (spec) => (spec.queryKeys ?? []).length > 0,
);

const specsWithSortFields = HERMES_READ_TOOL_SPECS.filter(
  (spec) => (spec.sortFields ?? []).length > 0,
);

describe("read tools and dashboard API routes", () => {
  it.each(apiReadSpecs)(
    "$name maps to a route file exporting $method",
    (spec) => {
      const routeUrl = routeFileUrl(spec.pathTemplate);

      const routeExists = existsSync(routeUrl);

      expect(routeExists, routeUrl.pathname).toBe(true);
      expect(exportsHandler(readRouteSource(spec), spec.method)).toBe(true);
    },
  );

  it.each(specsWithQueryKeys)(
    "$name sends only query keys its route reads",
    (spec) => {
      const routeSource = readRouteSource(spec);
      const sharedParserSource = readFileSync(SHARED_LIST_PARSER_PATH, "utf8");
      const usesSharedParser = SHARED_LIST_PARSER_CALL.test(routeSource);

      const unreadKeys = (spec.queryKeys ?? []).filter(
        (key) =>
          !readsQueryKey(routeSource, key) &&
          !(usesSharedParser && readsQueryKey(sharedParserSource, key)),
      );

      expect(unreadKeys, spec.pathTemplate).toEqual([]);
    },
  );

  it.each(specsWithSortFields)(
    "$name offers only sort fields its route accepts",
    (spec) => {
      const routeSource = readRouteSource(spec);

      const unknownSortFields = (spec.sortFields ?? []).filter(
        (field) => !routeSource.includes(`"${field}"`),
      );

      expect(unknownSortFields, spec.pathTemplate).toEqual([]);
    },
  );

  it("forwards domain row filters through the manifest filter parser", () => {
    const domainRowsSpec = HERMES_READ_TOOL_SPECS.find(
      (spec) => spec.name === "hermes_list_domain_rows",
    );
    if (!domainRowsSpec) {
      throw new Error("missing hermes_list_domain_rows");
    }

    const routeSource = readRouteSource(domainRowsSpec);

    expect(domainRowsSpec.filtersArgument).toBe("filters");
    expect(routeSource).toContain("parseDomainTableFilterValues(");
  });

  it("returns hasMore from the shared paginated response", () => {
    const responseSource = readFileSync(
      new URL("lib/api-paginated-list-response.ts", DASHBOARD_DIRECTORY),
      "utf8",
    );

    const paginatedRouteSources = HERMES_READ_TOOL_SPECS.filter(
      (spec) => spec.paginated,
    ).map(readRouteSource);

    expect(responseSource).toContain("hasMore");
    for (const routeSource of paginatedRouteSources) {
      expect(routeSource).toContain("paginatedListJsonResponse(");
    }
  });
});

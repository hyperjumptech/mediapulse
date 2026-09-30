import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildRequestBodyForSpec,
  buildSearchParamsForSpec,
  HERMES_READ_TOOL_SPECS,
  LIST_QUERY_KEYS,
  MAX_LIST_PAGE_SIZE,
  pathTemplateParameterNames,
  resolvePathTemplate,
  type HermesReadToolSpec,
} from "./tool-catalog.js";

const findSpec = (name: string): HermesReadToolSpec => {
  const spec = HERMES_READ_TOOL_SPECS.find((entry) => entry.name === name);
  if (!spec) {
    throw new Error(`missing spec ${name}`);
  }

  return spec;
};

const paginatedSpecs = HERMES_READ_TOOL_SPECS.filter((spec) => spec.paginated);

describe("resolvePathTemplate", () => {
  it("substitutes and encodes path parameters", () => {
    const path = resolvePathTemplate(
      "/api/domain-integrations/{integrationId}/{resource}/{itemId}",
      { integrationId: "acme", resource: "orders", itemId: "a b" },
    );

    expect(path).toBe("/api/domain-integrations/acme/orders/a%20b");
  });

  it("throws when a path parameter is missing", () => {
    expect(() =>
      resolvePathTemplate("/api/pipelines/{pipelineId}/schemas", {}),
    ).toThrow("Missing path parameter: pipelineId");
  });
});

describe("pathTemplateParameterNames", () => {
  it("lists placeholders in order", () => {
    expect(
      pathTemplateParameterNames(
        "/api/pipelines/{pipelineId}/executions/{executionId}",
      ),
    ).toEqual(["pipelineId", "executionId"]);
  });
});

describe("buildSearchParamsForSpec", () => {
  it("forwards page, pageSize, q, sort, and dir for list tools", () => {
    const params = buildSearchParamsForSpec(findSpec("hermes_list_agents"), {
      page: 2,
      pageSize: 50,
      q: "summar",
      sort: "updated",
      dir: "desc",
      agentId: "ignored",
    });

    expect(params).toEqual({
      page: 2,
      pageSize: 50,
      q: "summar",
      sort: "updated",
      dir: "desc",
    });
  });

  it("returns undefined when no query arguments are set", () => {
    expect(
      buildSearchParamsForSpec(findSpec("hermes_list_agents"), {}),
    ).toBeUndefined();
  });

  it("spreads domain row filters and lets list keys win on conflict", () => {
    const params = buildSearchParamsForSpec(
      findSpec("hermes_list_domain_rows"),
      {
        integrationId: "acme",
        resource: "orders",
        page: 3,
        filters: { status: "open", from: "2026-01-01", page: "9" },
      },
    );

    expect(params).toEqual({ status: "open", from: "2026-01-01", page: 3 });
  });

  it("ignores filters on tools without a filters argument", () => {
    expect(
      buildSearchParamsForSpec(findSpec("hermes_list_pipelines"), {
        filters: { status: "open" },
      }),
    ).toBeUndefined();
  });
});

describe("buildRequestBodyForSpec", () => {
  it("builds the POST body for variable reads", () => {
    const body = buildRequestBodyForSpec(findSpec("hermes_get_variable"), {
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(body).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("returns no body for GET tools", () => {
    expect(
      buildRequestBodyForSpec(findSpec("hermes_get_pipeline"), {
        pipelineId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toBeUndefined();
  });
});

describe("HERMES_READ_TOOL_SPECS", () => {
  it("uses unique tool names", () => {
    const names = HERMES_READ_TOOL_SPECS.map((spec) => spec.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a title and a one-line description", () => {
    for (const spec of HERMES_READ_TOOL_SPECS) {
      expect(spec.title.length, spec.name).toBeGreaterThan(0);
      expect(spec.description, spec.name).not.toContain("\n");
    }
  });

  it("includes the new pipeline, search, and domain row tools", () => {
    expect(findSpec("hermes_get_pipeline").pathTemplate).toBe(
      "/api/pipelines/{pipelineId}",
    );
    expect(findSpec("hermes_search").queryKeys).toEqual(["q"]);
    expect(findSpec("hermes_list_domain_views").pathTemplate).toBe(
      "/api/domain-integrations/{integrationId}/views",
    );
    expect(findSpec("hermes_get_domain_row").pathTemplate).toBe(
      "/api/domain-integrations/{integrationId}/{resource}/{itemId}",
    );
  });

  it("drops the old limit and cursor arguments from every tool", () => {
    for (const spec of HERMES_READ_TOOL_SPECS) {
      expect(spec.inputSchema, spec.name).not.toHaveProperty("limit");
      expect(spec.inputSchema, spec.name).not.toHaveProperty("cursor");
    }
  });

  it("gives every paginated tool the shared list query keys", () => {
    expect(paginatedSpecs.map((spec) => spec.name)).toEqual([
      "hermes_list_agents",
      "hermes_list_agent_configs",
      "hermes_list_agent_contracts",
      "hermes_list_pipelines",
      "hermes_list_schedules",
      "hermes_list_http_triggers",
      "hermes_list_variables",
      "hermes_list_domain_integrations",
      "hermes_list_domain_rows",
    ]);
    for (const spec of paginatedSpecs) {
      expect(spec.method, spec.name).toBe("GET");
      expect(spec.queryKeys, spec.name).toEqual(LIST_QUERY_KEYS);
      for (const key of LIST_QUERY_KEYS) {
        expect(spec.inputSchema, `${spec.name}.${key}`).toHaveProperty(key);
      }
    }
  });

  it("caps pageSize at the maximum and rejects unknown sort fields", () => {
    const listAgentsInput = z.object(
      findSpec("hermes_list_agents").inputSchema,
    );

    const maximumPageSize = listAgentsInput.safeParse({
      pageSize: MAX_LIST_PAGE_SIZE,
    });
    const oversizedPage = listAgentsInput.safeParse({
      pageSize: MAX_LIST_PAGE_SIZE + 1,
    });
    const unknownSort = listAgentsInput.safeParse({ sort: "secret" });

    expect(maximumPageSize.success).toBe(true);
    expect(oversizedPage.success).toBe(false);
    expect(unknownSort.success).toBe(false);
  });
});

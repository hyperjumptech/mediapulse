import {
  dashboardViewSchema,
  detailBlockSchema,
} from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { hermesDashboardResources } from "../../hermes-dashboard/hermes-dashboard-resource-registry";
import { buildKnowledgeBaseGraph } from "./build-knowledge-base-graph";
import { knowledgeBaseDashboardPage } from "./dashboard-page";

const declaredGraphBlock = () => {
  const graph = knowledgeBaseDashboardPage.detailBlocks.find(
    (block) => block.type === "graph",
  );
  if (graph?.type !== "graph") {
    throw new Error("expected a graph block");
  }

  return graph;
};

const parsedGraphBlock = () => {
  const parsed = dashboardViewSchema.parse(knowledgeBaseDashboardPage);
  if (parsed.kind !== "resource-table") {
    throw new Error("expected a resource table");
  }
  const graph = parsed.detailBlocks?.find((block) => block.type === "graph");
  if (graph?.type !== "graph") {
    throw new Error("expected a graph block");
  }

  return graph;
};

describe("knowledgeBaseDashboardPage", () => {
  it("satisfies the Hermes dashboard view contract", () => {
    const parsed = dashboardViewSchema.safeParse(knowledgeBaseDashboardPage);

    expect(parsed.success).toBe(true);
  });

  it("lists each issuer with its graph counts and freshness", () => {
    const keys = knowledgeBaseDashboardPage.columns.map((column) => column.key);

    expect(keys).toEqual([
      "symbol",
      "name",
      "entityCount",
      "relationCount",
      "articleCount",
      "lastSeenAt",
    ]);
  });

  it("formats the graph counts as numbers", () => {
    const formats = knowledgeBaseDashboardPage.columns
      .filter((column) =>
        ["entityCount", "relationCount", "articleCount"].includes(column.key),
      )
      .map((column) => column.format);

    expect(formats).toEqual(["number", "number", "number"]);
  });

  it("is read-only with a detail page", () => {
    expect(knowledgeBaseDashboardPage.actions).toStrictEqual({
      create: false,
      update: false,
      delete: false,
      view: true,
    });
  });

  it("declares an overview, a graph and the evidence tabs, in that order", () => {
    const types = knowledgeBaseDashboardPage.detailBlocks?.map(
      (block) => block.type,
    );

    expect(types).toStrictEqual(["panel", "graph", "tabs"]);
  });

  it("binds the graph block to the payload's graph fields", () => {
    const graph = declaredGraphBlock();

    expect(graph).toMatchObject({
      nodesField: "graph.nodes",
      edgesField: "graph.edges",
      maxNodes: 150,
    });
    expect(graph).not.toHaveProperty("orientation");
  });

  it("passes the graph block through the detail block contract unchanged", () => {
    const parsed = detailBlockSchema.safeParse(declaredGraphBlock());

    expect(parsed.success).toBe(true);
  });

  it("keeps every node detail field after the manifest is parsed", () => {
    const declared = declaredGraphBlock().node.detailFields;
    const parsed = parsedGraphBlock().node.detailFields;

    expect(declared).toHaveLength(7);
    expect(parsed).toStrictEqual(declared);
  });

  it("names only detail fields that some node in a drawn graph carries", () => {
    const payload = buildKnowledgeBaseGraph({
      ticker: { tickerId: "ticker-1", symbol: "FORE", name: "Fore" },
      entities: [
        {
          entityId: "mapi",
          canonicalName: "Mitra Adiperkasa",
          kind: "company",
          isIssuer: false,
          mentionCount: 1,
          sourceLabel: "Ticker Profile",
          surfaceForm: "Starbucks",
          aliases: [],
          articles: [
            {
              dataSourceId: "article-1",
              title: "Article 1",
              url: "https://example.test/1",
              publisher: "example.test",
              publishedAt: "2026-09-09T00:00:00.000Z",
            },
          ],
        },
      ],
      relations: [],
      totals: { entityCount: 1, relationCount: 0, articleCount: 1 },
    });

    const carried = parsedGraphBlock().node.detailFields?.filter(
      (detailField) =>
        payload.nodes.some((node) => {
          const value: unknown = Reflect.get(node, detailField.field);

          return value !== null && value !== undefined;
        }),
    );

    expect(carried).toStrictEqual(parsedGraphBlock().node.detailFields);
  });

  it("never tells the reader that graph nodes are listed elsewhere", () => {
    const graph = declaredGraphBlock();
    const copy = [graph.captionTemplate, graph.emptyState].join(" ");

    expect(copy).not.toMatch(/listed below|rather than drawn/i);
  });

  it("orders the sidebar entry the same way in both declarations", () => {
    const registered = hermesDashboardResources.find(
      (resource) => resource.resourceKey === "knowledgeBase",
    );

    expect(registered?.order).toBe(knowledgeBaseDashboardPage.order);
    expect(registered?.pathSegment).toBe(
      knowledgeBaseDashboardPage.pathSegment,
    );
  });
});

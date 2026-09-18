/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildKnowledgeBaseGraph,
  KB_GRAPH_ARTICLES_PER_ENTITY,
  KB_GRAPH_ENTITY_CAP,
  KB_GRAPH_RANK_ARTICLE,
  KB_GRAPH_RANK_ENTITY,
  KB_GRAPH_RANK_TICKER,
  type BuildKnowledgeBaseGraphInput,
  type GraphEntityInput,
} from "./build-knowledge-base-graph";

const article = (index: number) => ({
  dataSourceId: `article-${String(index)}`,
  title: `Article ${String(index)}`,
  url: `https://example.test/${String(index)}`,
  publisher: "example.test",
});

const entity = (
  overrides: Partial<GraphEntityInput> & { entityId: string },
): GraphEntityInput => ({
  canonicalName: overrides.entityId,
  kind: "company",
  isIssuer: false,
  mentionCount: 0,
  sourceLabel: "Ticker Profile",
  surfaceForm: null,
  articles: [],
  ...overrides,
});

const input = (
  overrides: Partial<BuildKnowledgeBaseGraphInput> = {},
): BuildKnowledgeBaseGraphInput => ({
  ticker: { tickerId: "ticker-1", symbol: "FORE", name: "Fore Kopi Indonesia" },
  entities: [],
  relations: [],
  totals: { entityCount: 0, relationCount: 0, articleCount: 0 },
  ...overrides,
});

describe("buildKnowledgeBaseGraph", () => {
  it("draws the issuer once, as the only emphasised node", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "peer" }),
        ],
      }),
    );

    const emphasised = payload.nodes.filter((node) => node.emphasis);

    expect(emphasised).toHaveLength(1);
    expect(emphasised[0]?.id).toBe("ticker:ticker-1");
    expect(
      payload.nodes.filter((node) => node.rank === KB_GRAPH_RANK_TICKER),
    ).toHaveLength(1);
    expect(payload.nodes.some((node) => node.id === "entity:issuer")).toBe(
      false,
    );
  });

  it("labels an edge from the issuer with the relation's own label", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "peer" }),
        ],
        relations: [
          {
            subjectEntityId: "issuer",
            objectEntityId: "peer",
            label: "competes with",
            inverseLabel: null,
          },
        ],
      }),
    );

    const edge = payload.edges.find((entry) => entry.target === "entity:peer");

    expect(edge?.label).toBe("competes with");
  });

  it("reads an edge backwards through the inverse label when the issuer is the object", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "bpom", kind: "regulator" }),
        ],
        relations: [
          {
            subjectEntityId: "bpom",
            objectEntityId: "issuer",
            label: "regulates",
            inverseLabel: "regulated by",
          },
        ],
      }),
    );

    const edge = payload.edges.find((entry) => entry.target === "entity:bpom");

    expect(edge?.label).toBe("regulated by");
  });

  it("never draws an edge between two nodes of the same rank", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "mapi" }),
          entity({ entityId: "starbucks", kind: "brand" }),
        ],
        relations: [
          {
            subjectEntityId: "mapi",
            objectEntityId: "starbucks",
            label: "operates the brand",
            inverseLabel: "operated by",
          },
        ],
      }),
    );

    const rankById = new Map(
      payload.nodes.map((node) => [node.id, node.rank] as const),
    );
    const sameRank = payload.edges.filter(
      (edge) => rankById.get(edge.source) === rankById.get(edge.target),
    );

    expect(sameRank).toHaveLength(0);
    expect(payload.truncatedLabel).toContain("listed below rather than drawn");
  });

  it("keeps an entity reachable when no relation ties it to the issuer", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "orphan" }),
        ],
      }),
    );

    const edge = payload.edges.find(
      (entry) => entry.target === "entity:orphan",
    );

    expect(edge?.source).toBe("ticker:ticker-1");
    expect(edge?.label).toBeNull();
  });

  it("caps the entity layer and says how many it left out", () => {
    const entities = [
      entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
      ...Array.from({ length: KB_GRAPH_ENTITY_CAP + 3 }, (_unused, index) =>
        entity({ entityId: `peer-${String(index)}` }),
      ),
    ];

    const payload = buildKnowledgeBaseGraph(input({ entities }));

    const drawnEntities = payload.nodes.filter(
      (node) => node.rank === KB_GRAPH_RANK_ENTITY && node.group !== "overflow",
    );

    expect(drawnEntities).toHaveLength(KB_GRAPH_ENTITY_CAP);
    expect(payload.truncated).toBe(true);
    expect(payload.truncatedLabel).toContain("3 more entities not drawn");
  });

  it("draws an overflow node for the articles one entity does not fit", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({
            entityId: "peer",
            mentionCount: KB_GRAPH_ARTICLES_PER_ENTITY + 4,
            articles: Array.from(
              { length: KB_GRAPH_ARTICLES_PER_ENTITY + 4 },
              (_unused, index) => article(index),
            ),
          }),
        ],
      }),
    );

    const drawnArticles = payload.nodes.filter(
      (node) =>
        node.rank === KB_GRAPH_RANK_ARTICLE && node.group !== "overflow",
    );
    const overflow = payload.nodes.find(
      (node) => node.id === "article:overflow:peer",
    );

    expect(drawnArticles).toHaveLength(KB_GRAPH_ARTICLES_PER_ENTITY);
    expect(overflow?.label).toBe("+4 more articles");
  });

  it("points an article node at its Data Source", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "peer", mentionCount: 1, articles: [article(1)] }),
        ],
      }),
    );

    const node = payload.nodes.find(
      (entry) => entry.id === "article:article-1",
    );

    expect(node?.linkResource).toBe("data-sources");
    expect(node?.linkId).toBe("article-1");
  });

  it("draws one node for an article two entities both name", () => {
    const shared = article(7);
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({ entityId: "peer-a", mentionCount: 1, articles: [shared] }),
          entity({ entityId: "peer-b", mentionCount: 1, articles: [shared] }),
        ],
      }),
    );

    const articleNodes = payload.nodes.filter(
      (node) => node.id === "article:article-7",
    );
    const incoming = payload.edges.filter(
      (edge) => edge.target === "article:article-7",
    );

    expect(articleNodes).toHaveLength(1);
    expect(incoming).toHaveLength(2);
  });

  it("says in the tooltip which spelling the corpus uses", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
          entity({
            entityId: "mapi",
            canonicalName: "Mitra Adiperkasa",
            surfaceForm: "Starbucks",
            mentionCount: 28,
          }),
        ],
      }),
    );

    const node = payload.nodes.find((entry) => entry.id === "entity:mapi");

    expect(node?.tooltip).toContain("28 articles");
    expect(node?.tooltip).toContain("seen as Starbucks");
  });

  it("reports nothing truncated for a graph that fits", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          entity({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
        ],
      }),
    );

    expect(payload.truncated).toBe(false);
    expect(payload.truncatedLabel).toBe("");
  });
});

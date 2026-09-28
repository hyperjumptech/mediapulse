import { describe, expect, it } from "vitest";

import {
  buildKnowledgeBaseGraph,
  KB_GRAPH_ARTICLES_PER_ENTITY,
  KB_GRAPH_ENTITY_CAP,
  KB_GRAPH_RANK_ARTICLE,
  KB_GRAPH_RANK_ENTITY,
  KB_GRAPH_RANK_TICKER,
  KB_GRAPH_TOTAL_ARTICLE_CAP,
  type BuildKnowledgeBaseGraphInput,
  type GraphArticleInput,
  type GraphEntityInput,
  type GraphRelationInput,
} from "./build-knowledge-base-graph";

const article = (index: number): GraphArticleInput => ({
  dataSourceId: `article-${String(index)}`,
  title: `Article ${String(index)}`,
  url: `https://example.test/${String(index)}`,
  publisher: "example.test",
  publishedAt: "2026-09-09T00:00:00.000Z",
});

const relation = (
  overrides: Partial<GraphRelationInput> & {
    subjectEntityId: string;
    objectEntityId: string;
  },
): GraphRelationInput => ({
  label: "competes with",
  inverseLabel: null,
  symmetric: false,
  ...overrides,
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
  aliases: [],
  articles: [],
  ...overrides,
});

const issuer = entity({ entityId: "issuer", isIssuer: true, kind: "issuer" });

const entityEdges = (
  payload: ReturnType<typeof buildKnowledgeBaseGraph>,
): ReturnType<typeof buildKnowledgeBaseGraph>["edges"] =>
  payload.edges.filter(
    (edge) =>
      edge.source.startsWith("entity:") && edge.target.startsWith("entity:"),
  );

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
        entities: [issuer, entity({ entityId: "peer" })],
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
        entities: [issuer, entity({ entityId: "peer" })],
        relations: [
          relation({ subjectEntityId: "issuer", objectEntityId: "peer" }),
        ],
      }),
    );

    const edge = payload.edges.find((entry) => entry.target === "entity:peer");

    expect(edge?.label).toBe("competes with");
  });

  it("reads an edge backwards through the inverse label when the issuer is the object", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [issuer, entity({ entityId: "bpom", kind: "regulator" })],
        relations: [
          relation({
            subjectEntityId: "bpom",
            objectEntityId: "issuer",
            label: "regulates",
            inverseLabel: "regulated by",
          }),
        ],
      }),
    );

    const edge = payload.edges.find((entry) => entry.target === "entity:bpom");

    expect(edge?.label).toBe("regulated by");
  });

  it("draws a labelled edge between two drawn entities and drops one whose end was capped away", () => {
    const peers = Array.from(
      { length: KB_GRAPH_ENTITY_CAP + 1 },
      (_unused, index) => entity({ entityId: `peer-${String(index)}` }),
    );
    const cappedAway = `peer-${String(KB_GRAPH_ENTITY_CAP)}`;
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [issuer, ...peers],
        relations: [
          relation({
            subjectEntityId: "peer-0",
            objectEntityId: "peer-1",
            label: "operates the brand",
            inverseLabel: "operated by",
          }),
          relation({
            subjectEntityId: "peer-2",
            objectEntityId: cappedAway,
            label: "supplies",
            inverseLabel: "supplied by",
          }),
        ],
      }),
    );

    expect(entityEdges(payload)).toStrictEqual([
      {
        source: "entity:peer-0",
        target: "entity:peer-1",
        label: "operates the brand",
      },
    ]);
    expect(
      payload.nodes.some((node) => node.id === `entity:${cappedAway}`),
    ).toBe(false);
  });

  it("draws one edge for a relation stored twice, including a symmetric one stored both ways", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({ entityId: "kenangan" }),
          entity({ entityId: "tomoro" }),
          entity({ entityId: "mapi" }),
          entity({ entityId: "starbucks", kind: "brand" }),
        ],
        relations: [
          relation({
            subjectEntityId: "kenangan",
            objectEntityId: "tomoro",
            symmetric: true,
          }),
          relation({
            subjectEntityId: "tomoro",
            objectEntityId: "kenangan",
            symmetric: true,
          }),
          relation({
            subjectEntityId: "mapi",
            objectEntityId: "starbucks",
            label: "operates the brand",
            inverseLabel: "operated by",
          }),
          relation({
            subjectEntityId: "mapi",
            objectEntityId: "starbucks",
            label: "operates the brand",
            inverseLabel: "operated by",
          }),
          relation({
            subjectEntityId: "starbucks",
            objectEntityId: "mapi",
            label: "operated by",
          }),
        ],
      }),
    );

    expect(entityEdges(payload)).toStrictEqual([
      {
        source: "entity:kenangan",
        target: "entity:tomoro",
        label: "competes with",
      },
      {
        source: "entity:mapi",
        target: "entity:starbucks",
        label: "operates the brand",
      },
    ]);
  });

  it("keeps two relations of different kinds between the same entities", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({ entityId: "mapi" }),
          entity({ entityId: "starbucks", kind: "brand" }),
        ],
        relations: [
          relation({
            subjectEntityId: "mapi",
            objectEntityId: "starbucks",
            label: "operates the brand",
            inverseLabel: "operated by",
          }),
          relation({
            subjectEntityId: "mapi",
            objectEntityId: "starbucks",
            label: "owns a stake in",
            inverseLabel: "part-owned by",
          }),
        ],
      }),
    );

    const labels = entityEdges(payload).map((edge) => edge.label);

    expect(labels).toStrictEqual(["operates the brand", "owns a stake in"]);
  });

  it("never draws a relation from an entity to itself", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [issuer, entity({ entityId: "mapi" })],
        relations: [
          relation({ subjectEntityId: "mapi", objectEntityId: "mapi" }),
          relation({ subjectEntityId: "issuer", objectEntityId: "issuer" }),
        ],
      }),
    );

    const selfLoops = payload.edges.filter(
      (edge) => edge.source === edge.target,
    );

    expect(selfLoops).toHaveLength(0);
    expect(entityEdges(payload)).toHaveLength(0);
  });

  it("keeps an entity reachable when no relation ties it to the issuer", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [issuer, entity({ entityId: "orphan" })],
      }),
    );

    const edge = payload.edges.find(
      (entry) => entry.target === "entity:orphan",
    );

    expect(edge?.source).toBe("ticker:ticker-1");
    expect(edge?.label).toBeNull();
  });

  it("caps the entity layer at 25, keeping the first entities it is given", () => {
    const entities = [
      issuer,
      ...Array.from({ length: 28 }, (_unused, index) =>
        entity({ entityId: `peer-${String(index)}` }),
      ),
    ];

    const payload = buildKnowledgeBaseGraph(input({ entities }));

    const drawnEntities = payload.nodes.filter(
      (node) => node.rank === KB_GRAPH_RANK_ENTITY && node.group !== "overflow",
    );
    const overflow = payload.nodes.find(
      (node) => node.id === "entity:overflow",
    );

    expect(KB_GRAPH_ENTITY_CAP).toBe(25);
    expect(drawnEntities).toHaveLength(25);
    expect(drawnEntities[drawnEntities.length - 1]?.id).toBe("entity:peer-24");
    expect(overflow?.label).toBe("+3 more entities");
    expect(payload.truncated).toBe(true);
    expect(payload.truncatedLabel).toBe("3 more entities not drawn.");
  });

  it("stops drawing articles at 50 across the graph, spending the allowance in entity order", () => {
    const entities = [
      issuer,
      ...Array.from({ length: 20 }, (_unused, entityIndex) =>
        entity({
          entityId: `peer-${String(entityIndex)}`,
          mentionCount: 3,
          articles: Array.from({ length: 3 }, (_unusedArticle, articleIndex) =>
            article(entityIndex * 3 + articleIndex),
          ),
        }),
      ),
    ];

    const payload = buildKnowledgeBaseGraph(input({ entities }));

    const drawnArticles = payload.nodes.filter(
      (node) =>
        node.rank === KB_GRAPH_RANK_ARTICLE && node.group !== "overflow",
    );
    const partlyDrawn = payload.nodes.find(
      (node) => node.id === "article:overflow:peer-16",
    );
    const undrawn = payload.nodes.find(
      (node) => node.id === "article:overflow:peer-17",
    );

    expect(KB_GRAPH_TOTAL_ARTICLE_CAP).toBe(50);
    expect(drawnArticles).toHaveLength(50);
    expect(drawnArticles[drawnArticles.length - 1]?.id).toBe(
      "article:article-49",
    );
    expect(partlyDrawn?.label).toBe("+1 more articles");
    expect(undrawn?.label).toBe("+3 more articles");
  });

  it("draws an overflow node for the articles one entity does not fit", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
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

    expect(KB_GRAPH_ARTICLES_PER_ENTITY).toBe(3);
    expect(drawnArticles.map((node) => node.id)).toStrictEqual([
      "article:article-0",
      "article:article-1",
      "article:article-2",
    ]);
    expect(overflow?.label).toBe("+4 more articles");
  });

  it("points an article node at its Data Source", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
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
          issuer,
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
          issuer,
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

  it("gives an entity node its kind, article count, other names and origin, and no article details", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({
            entityId: "mapi",
            canonicalName: "Mitra Adiperkasa",
            kind: "company",
            mentionCount: 28,
            sourceLabel: "Extracted from an article",
            surfaceForm: "Starbucks",
            aliases: ["Mitra Adiperkasa", "MAPI", "Starbucks"],
          }),
        ],
      }),
    );

    const node = payload.nodes.find((entry) => entry.id === "entity:mapi");

    expect(node).toMatchObject({
      kindLabel: "Company",
      mentionCount: 28,
      seenAs: "Starbucks, MAPI",
      sourceLabel: "Extracted from an article",
      publisher: null,
      publishedAt: null,
      url: null,
    });
  });

  it("leaves seen-as empty when the entity has no other name", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({
            entityId: "tomoro",
            canonicalName: "Tomoro Coffee",
            surfaceForm: "Tomoro Coffee",
            aliases: ["Tomoro Coffee"],
          }),
        ],
      }),
    );

    const node = payload.nodes.find((entry) => entry.id === "entity:tomoro");

    expect(node?.seenAs).toBeNull();
  });

  it("gives an article node its publisher, publish date and URL, and no entity details", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({ entityId: "peer", mentionCount: 1, articles: [article(1)] }),
        ],
      }),
    );

    const node = payload.nodes.find(
      (entry) => entry.id === "article:article-1",
    );

    expect(node).toMatchObject({
      publisher: "example.test",
      publishedAt: "2026-09-09T00:00:00.000Z",
      url: "https://example.test/1",
      kindLabel: null,
      mentionCount: null,
      seenAs: null,
      sourceLabel: null,
    });
  });

  it("carries no detail values on the issuer or an overflow node", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [
          issuer,
          entity({ entityId: "peer", mentionCount: 9, articles: [article(1)] }),
        ],
      }),
    );

    const detailValues = payload.nodes
      .filter((node) => node.group === "ticker" || node.group === "overflow")
      .map((node) => [
        node.kindLabel,
        node.mentionCount,
        node.seenAs,
        node.sourceLabel,
        node.publisher,
        node.publishedAt,
        node.url,
      ]);

    expect(detailValues).toHaveLength(2);
    expect(detailValues.flat().every((value) => value === null)).toBe(true);
  });

  it("reports nothing truncated for a graph that fits", () => {
    const payload = buildKnowledgeBaseGraph(
      input({
        entities: [issuer],
      }),
    );

    expect(payload.truncated).toBe(false);
    expect(payload.truncatedLabel).toBe("");
  });
});

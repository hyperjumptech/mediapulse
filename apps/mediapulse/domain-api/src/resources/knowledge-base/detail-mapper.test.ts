/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  mapRowToDetailItem,
  type KnowledgeBaseDetailRow,
  type MentionRow,
} from "./detail-mapper";

const entityLink = (
  overrides: Partial<{
    entityId: string;
    canonicalName: string;
    kind: string;
    isIssuer: boolean;
    mentionCount: number;
    source: string;
    aliases: string[];
  }> = {},
) => {
  const entityId = overrides.entityId ?? "entity-1";

  return {
    tickerId: "ticker-1",
    entityId,
    isIssuer: overrides.isIssuer ?? false,
    source: overrides.source ?? "profile",
    mentionCount: overrides.mentionCount ?? 0,
    firstSeenAt: new Date("2026-09-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-09-10T00:00:00.000Z"),
    entity: {
      id: entityId,
      kind: overrides.kind ?? "company",
      canonicalName: overrides.canonicalName ?? "Kopi Kenangan",
      source: overrides.source ?? "profile",
      aliases: (overrides.aliases ?? []).map((alias) => ({ alias })),
    },
  };
};

const relationLink = (
  overrides: Partial<{
    relationId: string;
    subjectEntityId: string;
    objectEntityId: string;
    label: string | null;
    source: string;
    evidenceSpan: string | null;
    kindLabel: string;
    inverseLabel: string | null;
    curated: boolean;
  }> = {},
) => ({
  tickerId: "ticker-1",
  relationId: overrides.relationId ?? "relation-1",
  source: overrides.source ?? "profile",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  relation: {
    id: overrides.relationId ?? "relation-1",
    subjectEntityId: overrides.subjectEntityId ?? "issuer",
    objectEntityId: overrides.objectEntityId ?? "entity-1",
    kindSlug: "competes_with",
    label: overrides.label ?? null,
    source: overrides.source ?? "profile",
    observations: 1,
    evidenceSpan: overrides.evidenceSpan ?? null,
    evidenceDataSourceId: null,
    lastObservedAt: new Date("2026-09-10T00:00:00.000Z"),
    kind: {
      label: overrides.kindLabel ?? "competes with",
      inverseLabel: overrides.inverseLabel ?? null,
      curated: overrides.curated ?? true,
    },
    subjectEntity: { canonicalName: "Fore Kopi Indonesia" },
    objectEntity: { canonicalName: "Kopi Kenangan" },
  },
});

const row = (
  entities: ReturnType<typeof entityLink>[],
  relations: ReturnType<typeof relationLink>[] = [],
): KnowledgeBaseDetailRow =>
  ({
    id: "ticker-1",
    symbol: "FORE",
    name: "Fore Kopi Indonesia",
    knowledgeTickerEntities: entities,
    knowledgeTickerRelations: relations,
  }) as unknown as KnowledgeBaseDetailRow;

const mention = (
  overrides: Partial<MentionRow> & { entityId: string; dataSourceId: string },
): MentionRow => ({
  surfaceForm: null,
  evidenceSpan: null,
  dataSource: {
    id: overrides.dataSourceId,
    title: `Article ${overrides.dataSourceId}`,
    url: `https://example.test/${overrides.dataSourceId}`,
    registrableDomain: "example.test",
    publishedAt: new Date("2026-09-09T00:00:00.000Z"),
  },
  ...overrides,
});

describe("mapRowToDetailItem", () => {
  it("titles the page with the symbol and the issuer's name", () => {
    const item = mapRowToDetailItem(row([entityLink()]), []);

    expect(item.title).toBe("FORE — Fore Kopi Indonesia");
  });

  it("counts a relation with no evidence span as coming from the profile", () => {
    const item = mapRowToDetailItem(
      row(
        [entityLink()],
        [
          relationLink({ relationId: "seeded" }),
          relationLink({
            relationId: "grounded",
            source: "extracted",
            evidenceSpan: "Fore bersaing dengan Kopi Kenangan",
          }),
        ],
      ),
      [],
    );

    expect(item.profileRelationCount).toBe(1);
    expect(item.extractedRelationCount).toBe(1);
    expect(item.header.groundingVariant).toBe("success");
  });

  it("warns when nothing in the graph is article-grounded", () => {
    const item = mapRowToDetailItem(row([entityLink()], [relationLink()]), []);

    expect(item.header.groundingVariant).toBe("warning");
  });

  it("lists one row per article however many entities it names", () => {
    const item = mapRowToDetailItem(
      row([
        entityLink({ entityId: "a", canonicalName: "Kopi Kenangan" }),
        entityLink({ entityId: "b", canonicalName: "Tomoro Coffee" }),
      ]),
      [
        mention({ entityId: "a", dataSourceId: "article-1" }),
        mention({ entityId: "b", dataSourceId: "article-1" }),
      ],
    );

    expect(item.articles).toHaveLength(1);
    expect(item.articles[0]?.entityNames).toBe("Kopi Kenangan, Tomoro Coffee");
    expect(item.articleCount).toBe(1);
  });

  it("drops the canonical name from the alias list it prints", () => {
    const item = mapRowToDetailItem(
      row([
        entityLink({
          canonicalName: "Mitra Adiperkasa",
          aliases: ["Mitra Adiperkasa", "MAPI", "Starbucks"],
        }),
      ]),
      [],
    );

    expect(item.entities[0]?.aliases).toBe("MAPI, Starbucks");
  });

  it("hands the graph the spelling the corpus uses", () => {
    const item = mapRowToDetailItem(
      row([
        entityLink({
          entityId: "mapi",
          canonicalName: "Mitra Adiperkasa",
          mentionCount: 1,
          isIssuer: false,
        }),
        entityLink({ entityId: "issuer", isIssuer: true, kind: "issuer" }),
      ]),
      [
        mention({
          entityId: "mapi",
          dataSourceId: "article-1",
          surfaceForm: "Starbucks",
        }),
      ],
    );

    const node = item.graph.nodes.find((entry) => entry.id === "entity:mapi");

    expect(node?.tooltip).toContain("seen as Starbucks");
  });

  it("prints an em dash for a relation no article states", () => {
    const item = mapRowToDetailItem(row([entityLink()], [relationLink()]), []);

    expect(item.relations[0]?.evidenceSpan).toBe("—");
    expect(item.relations[0]?.emittedLabel).toBe("—");
  });

  it("marks a relation kind the extraction invented", () => {
    const item = mapRowToDetailItem(
      row(
        [entityLink()],
        [
          relationLink({
            curated: false,
            label: "sponsors",
            source: "extracted",
            evidenceSpan: "Fore menjadi sponsor acara",
          }),
        ],
      ),
      [],
    );

    expect(item.relations[0]?.curatedLabel).toBe("new kind");
    expect(item.relations[0]?.emittedLabel).toBe("sponsors");
  });
});

/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  applyExtractionGuards,
  entityIsNamedInText,
  extractEntityRelations,
  spanIsInText,
} from "./extract-entity-relations.js";
import type { EntityExtraction } from "./entity-extraction-schema.js";

const issuer = {
  symbol: "FORE",
  name: "Fore Kopi Indonesia",
  aliases: ["Fore Coffee"],
  companyOverview: "Coffee chain.",
};

const articleText =
  "Fore Coffee dan Kopi Kenangan bersaing di pasar kopi. BPOM menerbitkan aturan baru.";

const extraction = (
  overrides: Partial<EntityExtraction> = {},
): EntityExtraction => ({
  entities: [],
  relations: [],
  ...overrides,
});

describe("spanIsInText", () => {
  it("accepts a span copied verbatim", () => {
    expect(spanIsInText(articleText, "Kopi Kenangan bersaing")).toBe(true);
  });

  it("accepts a span that differs only in whitespace", () => {
    expect(spanIsInText(articleText, "Kopi Kenangan\n  bersaing")).toBe(true);
  });

  it("rejects a paraphrase", () => {
    expect(spanIsInText(articleText, "Kopi Kenangan is a rival")).toBe(false);
  });

  it("rejects an empty span", () => {
    expect(spanIsInText(articleText, "   ")).toBe(false);
  });
});

describe("entityIsNamedInText", () => {
  it("accepts a party the article names", () => {
    const named = entityIsNamedInText(articleText, {
      name: "Kopi Kenangan",
      kind: "company",
      surfaceForm: "Kopi Kenangan",
      evidenceSpan: "Kopi Kenangan bersaing",
    });

    expect(named).toBe(true);
  });

  it("rejects a party the article never names", () => {
    const named = entityIsNamedInText(articleText, {
      name: "Tomoro Coffee",
      kind: "company",
      surfaceForm: "Tomoro",
      evidenceSpan: "Kopi Kenangan bersaing",
    });

    expect(named).toBe(false);
  });
});

describe("applyExtractionGuards", () => {
  it("drops an entity whose span is not in the article", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "a sentence the article never carried",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections).toStrictEqual([
      { reason: "span-not-in-text", detail: "Kopi Kenangan" },
    ]);
  });

  it("drops an entity the article does not name, however good the span", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Starbucks",
            kind: "brand",
            surfaceForm: "Starbucks",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections[0]?.reason).toBe("name-not-in-text");
  });

  it("skips the issuer, which already has an entity", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Fore Kopi Indonesia",
            kind: "company",
            surfaceForm: "Fore Coffee",
            evidenceSpan: "Fore Coffee dan Kopi Kenangan",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections).toHaveLength(0);
  });

  it("keeps a relation between the issuer and an entity it kept", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
        relations: [
          {
            subject: "Fore Coffee",
            kind: "competes with",
            object: "Kopi Kenangan",
            evidenceSpan: "Fore Coffee dan Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.relations).toHaveLength(1);
    expect(guarded.relations[0]?.subject).toBe("Fore Kopi Indonesia");
  });

  it("drops a relation whose endpoint no surviving entity covers", () => {
    const guarded = applyExtractionGuards(
      extraction({
        relations: [
          {
            subject: "Fore Coffee",
            kind: "competes with",
            object: "Tomoro Coffee",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.relations).toHaveLength(0);
    expect(guarded.rejections[0]?.reason).toBe("endpoint-unknown");
  });

  it("drops a relation from a party to itself", () => {
    const guarded = applyExtractionGuards(
      extraction({
        relations: [
          {
            subject: "Fore Coffee",
            kind: "competes with",
            object: "Fore Kopi Indonesia",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.relations).toHaveLength(0);
    expect(guarded.rejections[0]?.reason).toBe("self-relation");
  });
});

describe("extractEntityRelations", () => {
  it("calls no model for an article with no text", async () => {
    const generateObjectFn = vi.fn();

    const outcome = await extractEntityRelations({
      article: { title: "   ", description: null, content: null },
      issuer,
      candidates: [],
      relationKindLabels: [],
      llm: { model: "m", apiKey: "k", baseUrl: "http://localhost" },
      generateObjectFn: generateObjectFn as never,
    });

    expect(outcome.modelCalled).toBe(false);
    expect(generateObjectFn).not.toHaveBeenCalled();
  });

  it("guards whatever the model returns before handing it back", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
          {
            name: "Tomoro Coffee",
            kind: "company",
            surfaceForm: "Tomoro",
            evidenceSpan: "an invented sentence",
          },
        ],
        relations: [],
      },
    });

    const outcome = await extractEntityRelations({
      article: { title: articleText, description: null, content: null },
      issuer,
      candidates: [],
      relationKindLabels: ["competes with"],
      llm: { model: "m", apiKey: "k", baseUrl: "http://localhost" },
      generateObjectFn: generateObjectFn as never,
    });

    expect(outcome.modelCalled).toBe(true);
    expect(outcome.entities.map((entity) => entity.name)).toStrictEqual([
      "Kopi Kenangan",
    ]);
    expect(outcome.rejections).toHaveLength(1);
  });
});

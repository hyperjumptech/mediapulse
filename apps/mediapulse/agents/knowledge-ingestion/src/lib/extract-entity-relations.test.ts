/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  applyExtractionGuards,
  clipSpan,
  entityIsNamedInText,
  extractEntityRelations,
  spanIsInText,
} from "./extract-entity-relations.js";
import {
  entityExtractionSchema,
  MAX_EVIDENCE_SPAN_CHARS,
  type EntityExtraction,
} from "./entity-extraction-schema.js";

const issuer = {
  symbol: "FORE",
  name: "Fore Kopi Indonesia",
  aliases: ["Fore Coffee"],
  companyOverview: "Coffee chain.",
};

const articleText =
  "Fore Coffee dan Kopi Kenangan bersaing di pasar kopi. BPOM menerbitkan aturan baru.";

const longSentence = `${"Pasar kopi tumbuh pesat di kota besar ".repeat(12)}dan Kopi Kenangan bersaing dengan Fore Coffee ${"di setiap sudut jalan ".repeat(10)}hari ini.`;

const longArticleText = `${longSentence} BPOM menerbitkan aturan baru.`;

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

describe("clipSpan", () => {
  it("returns a span that fits as it is", () => {
    expect(clipSpan("  Kopi Kenangan bersaing  ", ["Kopi Kenangan"])).toBe(
      "Kopi Kenangan bersaing",
    );
  });

  it("cuts a long span to the limit around the party it names", () => {
    const clipped = clipSpan(longSentence, ["Kopi Kenangan"]);

    expect(clipped.length).toBeLessThanOrEqual(MAX_EVIDENCE_SPAN_CHARS);
    expect(clipped).toContain("Kopi Kenangan");
    expect(longSentence).toContain(clipped);
  });

  it("keeps both parties of a relation when they fit in one window", () => {
    const clipped = clipSpan(longSentence, ["Kopi Kenangan", "Fore Coffee"]);

    expect(clipped).toContain("Kopi Kenangan");
    expect(clipped).toContain("Fore Coffee");
  });

  it("starts at the first party when the two are too far apart", () => {
    const span = `Kopi Kenangan ${"x ".repeat(300)}Fore Coffee`;

    const clipped = clipSpan(span, ["Kopi Kenangan", "Fore Coffee"], 100);

    expect(clipped.startsWith("Kopi Kenangan")).toBe(true);
    expect(clipped.length).toBeLessThanOrEqual(100);
  });

  it("fills the whole limit when the party sits near the start", () => {
    const span = `Kopi Kenangan ${"kata ".repeat(100)}`;

    const clipped = clipSpan(span, ["Kopi Kenangan"], 100);

    expect(clipped.startsWith("Kopi Kenangan")).toBe(true);
    expect(clipped.length).toBeGreaterThanOrEqual(99);
  });

  it("keeps the opening of the span when no party is found in it", () => {
    const clipped = clipSpan(longSentence, ["Tomoro"], 50);

    expect(longSentence.startsWith(clipped)).toBe(true);
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

  it("drops a person and counts it, rather than letting the model disguise one", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Sheila Dara",
            kind: "person",
            surfaceForm: "Sheila Dara",
            evidenceSpan: "Fore Coffee dan Kopi Kenangan",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections).toEqual([
      { reason: "person", detail: "Sheila Dara" },
    ]);
  });

  it("keeps an entity whose span runs past the limit, clipped to where it is named", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: longSentence,
          },
        ],
      }),
      longArticleText,
      issuer,
    );
    const [kept] = guarded.entities;

    expect(guarded.rejections).toStrictEqual([]);
    expect(kept?.evidenceSpan.length).toBeLessThanOrEqual(
      MAX_EVIDENCE_SPAN_CHARS,
    );
    expect(kept?.evidenceSpan).toContain("Kopi Kenangan");
    expect(spanIsInText(longArticleText, kept?.evidenceSpan ?? "")).toBe(true);
  });

  it("still refuses a long span the article does not contain", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "Kopi Kenangan",
            evidenceSpan: `${longSentence} and an invented clause`,
          },
        ],
      }),
      longArticleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections).toStrictEqual([
      { reason: "span-not-in-text", detail: "Kopi Kenangan" },
    ]);
  });

  it("fills an empty surface form from the name, which the write boundary requires", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "Kopi Kenangan",
            kind: "company",
            surfaceForm: "",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities[0]?.surfaceForm).toBe("Kopi Kenangan");
  });

  it("refuses an entity with no name at all, instead of failing the article", () => {
    const guarded = applyExtractionGuards(
      extraction({
        entities: [
          {
            name: "",
            kind: "company",
            surfaceForm: "",
            evidenceSpan: "Kopi Kenangan bersaing",
          },
        ],
      }),
      articleText,
      issuer,
    );

    expect(guarded.entities).toHaveLength(0);
    expect(guarded.rejections).toStrictEqual([
      { reason: "name-not-in-text", detail: "" },
    ]);
  });

  it("clips a long relation span around both of its parties", () => {
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
            subject: "Kopi Kenangan",
            kind: "competes with",
            object: "Fore Coffee",
            evidenceSpan: longSentence,
          },
        ],
      }),
      longArticleText,
      issuer,
    );
    const [relation] = guarded.relations;

    expect(relation?.evidenceSpan.length).toBeLessThanOrEqual(
      MAX_EVIDENCE_SPAN_CHARS,
    );
    expect(relation?.evidenceSpan).toContain("Kopi Kenangan");
    expect(relation?.evidenceSpan).toContain("Fore Coffee");
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

  it("retries once when the model call fails, and keeps the second answer", async () => {
    const generateObjectFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("No object generated"))
      .mockResolvedValueOnce({
        object: {
          entities: [
            {
              name: "Kopi Kenangan",
              kind: "company",
              surfaceForm: "Kopi Kenangan",
              evidenceSpan: "Kopi Kenangan bersaing",
            },
          ],
          relations: [],
        },
      });

    const outcome = await extractEntityRelations({
      article: { title: articleText, description: null, content: null },
      issuer,
      candidates: [],
      relationKindLabels: [],
      llm: { model: "m", apiKey: "k", baseUrl: "http://localhost" },
      generateObjectFn: generateObjectFn as never,
    });

    expect(generateObjectFn).toHaveBeenCalledTimes(2);
    expect(outcome.entities.map((entity) => entity.name)).toStrictEqual([
      "Kopi Kenangan",
    ]);
  });

  it("gives up after the second failure, so the caller records the article", async () => {
    const generateObjectFn = vi
      .fn()
      .mockRejectedValue(new Error("Invalid JSON response"));

    const call = extractEntityRelations({
      article: { title: articleText, description: null, content: null },
      issuer,
      candidates: [],
      relationKindLabels: [],
      llm: { model: "m", apiKey: "k", baseUrl: "http://localhost" },
      generateObjectFn: generateObjectFn as never,
    });

    await expect(call).rejects.toThrow("Invalid JSON response");
    expect(generateObjectFn).toHaveBeenCalledTimes(2);
  });
});

describe("entityExtractionSchema", () => {
  it("accepts one overlong span and one empty name, so neither sinks the article", () => {
    const parsed = entityExtractionSchema.safeParse({
      entities: [
        {
          name: "Kopi Kenangan",
          kind: "company",
          surfaceForm: "",
          evidenceSpan: "a".repeat(900),
        },
      ],
      relations: [
        {
          subject: "Kopi Kenangan",
          kind: "competes with",
          object: "",
          evidenceSpan: "b".repeat(900),
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});

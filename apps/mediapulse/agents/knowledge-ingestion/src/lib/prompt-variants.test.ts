import { describe, expect, it } from "vitest";

import { buildExtractionMessages } from "./build-extraction-messages.js";
import { entityExtractionSchema } from "./entity-extraction-schema.js";
import {
  buildLegacyExtractionMessages,
  buildNoPersonKindMessages,
  legacyExtractionSchema,
  noPersonKindExtractionSchema,
  PROMPT_VARIANTS,
} from "./prompt-variants.js";

const input = {
  article: {
    title: "ACES buka gerai baru",
    description: null,
    content: "PT Ace Hardware Indonesia Tbk membuka gerai baru di Jakarta.",
  },
  issuer: {
    symbol: "ACES",
    name: "PT Aspirasi Hidup Indonesia Tbk",
    aliases: ["ACES"],
    companyOverview: "Home improvement retailer.",
  },
  candidates: [
    { name: "Mitra Adiperkasa", aliases: ["MAPI"], kind: "company" as const },
  ],
  relationKindLabels: ["competes with", "regulates"],
};

const personEntity = {
  entities: [
    {
      name: "Sheila Dara",
      kind: "person",
      surfaceForm: "Sheila Dara",
      evidenceSpan: "Sheila Dara menjadi brand ambassador.",
    },
  ],
  relations: [],
};

describe("the production schema", () => {
  it("accepts a person, so the model never has to disguise one", () => {
    expect(entityExtractionSchema.safeParse(personEntity).success).toBe(true);
  });

  it("still refuses the issuer kind, which only the profile seed writes", () => {
    const parsed = entityExtractionSchema.safeParse({
      entities: [
        {
          name: "Fore Kopi Indonesia",
          kind: "issuer",
          surfaceForm: "Fore Coffee",
          evidenceSpan: "Fore Coffee dan Kopi Kenangan bersaing.",
        },
      ],
      relations: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("the production prompt", () => {
  it("tells the model to label a person rather than forbidding the report", () => {
    const [system] = buildExtractionMessages(input) as unknown as [
      { content: string },
    ];

    expect(system!.content).toContain("you must set kind to `person`");
    expect(system!.content).not.toContain("Never record a person.");
  });

  it("warns against the failure this replaced", () => {
    const [system] = buildExtractionMessages(input) as unknown as [
      { content: string },
    ];

    expect(system!.content).toContain("a person disguised as a company");
  });
});

describe("the frozen baselines the benchmark compares against", () => {
  it("keeps the prompt that forbade the person kind", () => {
    const messages = buildNoPersonKindMessages(input) as { content: string }[];

    expect(messages[0]!.content).toContain("Never record a person.");
    expect(noPersonKindExtractionSchema.safeParse(personEntity).success).toBe(
      false,
    );
  });

  it("keeps the original prompt, which allowed a person and never warned", () => {
    const messages = buildLegacyExtractionMessages(input) as {
      content: string;
    }[];

    expect(messages[0]!.content).not.toContain("Never record a person.");
    expect(legacyExtractionSchema.safeParse(personEntity).success).toBe(true);
  });

  it("carries the article and the parties on file", () => {
    const messages = buildNoPersonKindMessages(input) as { content: string }[];

    expect(messages[1]!.content).toContain("membuka gerai baru");
    expect(messages[1]!.content).toContain("Mitra Adiperkasa");
  });
});

describe("PROMPT_VARIANTS", () => {
  it("points its production variant at the live builder and schema", () => {
    expect(PROMPT_VARIANTS["v3-production"].build).toBe(
      buildExtractionMessages,
    );
    expect(PROMPT_VARIANTS["v3-production"].schema).toBe(
      entityExtractionSchema,
    );
  });

  it("keeps the legacy variant on the observed vocabulary", () => {
    expect(PROMPT_VARIANTS["v0-legacy"].vocabulary).toBe("observed");
    expect(PROMPT_VARIANTS["v3-production"].vocabulary).toBe("curated");
  });
});

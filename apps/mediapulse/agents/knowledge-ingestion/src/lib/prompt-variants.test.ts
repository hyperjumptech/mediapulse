import { describe, expect, it } from "vitest";

import { buildExtractionMessages } from "./build-extraction-messages.js";
import { entityExtractionSchema } from "./entity-extraction-schema.js";
import {
  buildLegacyExtractionMessages,
  legacyExtractionSchema,
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
      name: "Billy Utama",
      kind: "person",
      surfaceForm: "Billy Utama",
      evidenceSpan: "Billy Utama is the director of the company.",
    },
  ],
  relations: [],
};

describe("the production schema", () => {
  it("rejects a person entity outright", () => {
    expect(entityExtractionSchema.safeParse(personEntity).success).toBe(false);
  });

  it("accepts a company entity", () => {
    const parsed = entityExtractionSchema.safeParse({
      entities: [
        {
          name: "Mitra Adiperkasa",
          kind: "company",
          surfaceForm: "MAPI",
          evidenceSpan: "MAPI membuka gerai baru di Jakarta.",
        },
      ],
      relations: [],
    });

    expect(parsed.success).toBe(true);
  });
});

describe("the legacy baseline the benchmark compares against", () => {
  it("still accepts a person, which is what it was measured doing", () => {
    expect(legacyExtractionSchema.safeParse(personEntity).success).toBe(true);
  });

  it("carries the article and the parties on file", () => {
    const messages = buildLegacyExtractionMessages(input);

    expect(messages[1]!.content).toContain("membuka gerai baru");
    expect(messages[1]!.content).toContain("Mitra Adiperkasa");
  });

  it("does not tell the model to skip people", () => {
    const messages = buildLegacyExtractionMessages(input);

    expect(messages[0]!.content).not.toContain("Never record a person");
  });
});

describe("PROMPT_VARIANTS", () => {
  it("points its focused variant at the production builder", () => {
    expect(PROMPT_VARIANTS["v2-focused"].build).toBe(buildExtractionMessages);
    expect(PROMPT_VARIANTS["v2-focused"].vocabulary).toBe("curated");
  });

  it("keeps the legacy variant on the observed vocabulary", () => {
    expect(PROMPT_VARIANTS["v0-legacy"].vocabulary).toBe("observed");
  });
});

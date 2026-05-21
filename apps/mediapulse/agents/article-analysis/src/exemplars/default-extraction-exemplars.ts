import type { LlmExtractionWireOutput } from "../llm-extract-entities.js";

export type ExtractionExemplarArchetype =
  | "earnings"
  | "legal"
  | "leadership"
  | "product";

/** Wire output shape with sentinel placeholders in UUID fields before resolution. */
export type ExtractionExemplarExpectedOutput = {
  entities: Array<{
    canonicalName: string;
    typeId: string;
    description: string;
    aliases: string[];
  }>;
  relations: Array<{
    fromEntityName: string;
    toEntityName: string;
    relationTypeId: string;
  }>;
  articleMentions: Array<{
    entityName: string;
    mentionCount: number;
    confidence: number;
    sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NONE";
  }>;
};

export type ExtractionExemplar = {
  archetype: ExtractionExemplarArchetype;
  articleSnippet: string;
  expectedOutput: ExtractionExemplarExpectedOutput;
};

export type ResolvedExemplar = {
  archetype: ExtractionExemplarArchetype;
  articleSnippet: string;
  expectedOutput: LlmExtractionWireOutput;
};

const earningsExemplar: ExtractionExemplar = {
  archetype: "earnings",
  articleSnippet: [
    "Jakarta — Bank Central Asia reported fourth-quarter net income of Rp 12.4 trillion,",
    "beating analyst estimates as net interest margins expanded to 6.1%.",
    "Management raised full-year guidance and said loan growth should stay above 10%",
    "despite tighter liquidity in Indonesia. The bank noted deposit inflows remained",
    "strong in retail and small-business segments. Shares of BBCA.JK rose 2.3% in",
    "afternoon trading after the company said credit costs normalized and fee income",
    "from wealth products continued to offset slower corporate lending. CFO Dian",
    "Permata told investors the beat reflected disciplined pricing rather than",
    "one-off gains, and that the lender would keep returning excess capital through",
    "dividends while funding digital onboarding and branch automation.",
  ].join(" "),
  expectedOutput: {
    entities: [
      {
        canonicalName: "Bank Central Asia",
        typeId: "{{ENTITY_TYPE:COMPANY}}",
        description: "Indonesian lender reporting earnings beat and raised guidance",
        aliases: ["BBCA", "the bank"],
      },
      {
        canonicalName: "Dian Permata",
        typeId: "{{ENTITY_TYPE:PERSON}}",
        description: "CFO commenting on margins and capital returns",
        aliases: [],
      },
    ],
    relations: [],
    articleMentions: [
      {
        entityName: "Bank Central Asia",
        mentionCount: 6,
        confidence: 0.95,
        sentiment: "POSITIVE",
      },
      {
        entityName: "Dian Permata",
        mentionCount: 1,
        confidence: 0.85,
        sentiment: "NEUTRAL",
      },
    ],
  },
};

const legalExemplar: ExtractionExemplar = {
  archetype: "legal",
  articleSnippet: [
    "Washington — The Securities and Exchange Commission opened a formal investigation",
    "into NovaTech Systems after whistleblowers alleged the cloud vendor misstated",
    "recurring revenue in its S-1 filing. Regulators requested internal spreadsheets,",
    "customer contracts, and board minutes dating back to 2022. NovaTech said it would",
    "cooperate fully and has not been accused of wrongdoing. Analysts warned that a",
    "prolonged probe could delay the company's planned secondary offering and pressure",
    "enterprise customers to pause renewals. Legal experts noted the SEC typically",
    "focuses first on disclosure controls before deciding whether to bring enforcement",
    "action. NovaTech shares fell 8% in after-hours trading on the news.",
  ].join(" "),
  expectedOutput: {
    entities: [
      {
        canonicalName: "NovaTech Systems",
        typeId: "{{ENTITY_TYPE:COMPANY}}",
        description: "Cloud vendor under SEC investigation over revenue disclosures",
        aliases: ["NovaTech", "the company"],
      },
      {
        canonicalName: "Securities and Exchange Commission",
        typeId: "{{ENTITY_TYPE:Regulator}}",
        description: "US regulator investigating alleged misstated recurring revenue",
        aliases: ["SEC", "regulators"],
      },
    ],
    relations: [],
    articleMentions: [
      {
        entityName: "NovaTech Systems",
        mentionCount: 4,
        confidence: 0.92,
        sentiment: "NEGATIVE",
      },
      {
        entityName: "Securities and Exchange Commission",
        mentionCount: 3,
        confidence: 0.9,
        sentiment: "NEUTRAL",
      },
    ],
  },
};

const leadershipExemplar: ExtractionExemplar = {
  archetype: "leadership",
  articleSnippet: [
    "San Francisco — Horizon Robotics named Maria Chen as chief executive officer,",
    "replacing founder James Okonkwo who will become executive chairman. Chen joins",
    "from Apex Motors where she led autonomous-driving partnerships across Asia.",
    "The board said the transition follows a year-long succession review and that",
    "Okonkwo will remain involved in strategy and major customer relationships.",
    "Horizon also promoted its finance chief to president while keeping the COO in",
    "place to run manufacturing. Investors welcomed the move, citing Chen's track",
    "record scaling supplier deals, though some analysts asked whether the handoff",
    "would slow product launches scheduled for late 2026.",
  ].join(" "),
  expectedOutput: {
    entities: [
      {
        canonicalName: "Horizon Robotics",
        typeId: "{{ENTITY_TYPE:COMPANY}}",
        description: "Robotics company announcing CEO succession",
        aliases: ["Horizon"],
      },
      {
        canonicalName: "Maria Chen",
        typeId: "{{ENTITY_TYPE:PERSON}}",
        description: "Incoming CEO previously at Apex Motors",
        aliases: ["Chen"],
      },
      {
        canonicalName: "James Okonkwo",
        typeId: "{{ENTITY_TYPE:PERSON}}",
        description: "Founder moving to executive chairman role",
        aliases: ["Okonkwo"],
      },
    ],
    relations: [
      {
        fromEntityName: "Maria Chen",
        toEntityName: "Horizon Robotics",
        relationTypeId: "{{RELATION_TYPE:CEO_OF}}",
      },
    ],
    articleMentions: [
      {
        entityName: "Horizon Robotics",
        mentionCount: 4,
        confidence: 0.93,
        sentiment: "POSITIVE",
      },
      {
        entityName: "Maria Chen",
        mentionCount: 3,
        confidence: 0.9,
        sentiment: "POSITIVE",
      },
      {
        entityName: "James Okonkwo",
        mentionCount: 2,
        confidence: 0.88,
        sentiment: "NEUTRAL",
      },
    ],
  },
};

const productExemplar: ExtractionExemplar = {
  archetype: "product",
  articleSnippet: [
    "Seattle — CloudScale Inc unveiled Atlas Edge, a managed inference platform",
    "aimed at retailers that need low-latency model hosting outside public clouds.",
    "The company said Atlas Edge integrates with existing Kubernetes clusters and",
    "ships with pre-built adapters for major payment gateways. CloudScale also",
    "announced a multi-year partnership with RetailNext to co-sell the platform to",
    "grocery chains in North America. RetailNext will provide onboarding teams while",
    "CloudScale handles model optimization and uptime guarantees. Early adopters",
    "include two regional grocers testing dynamic pricing models during peak hours.",
    "Management expects Atlas Edge to contribute to recurring revenue in 2027.",
  ].join(" "),
  expectedOutput: {
    entities: [
      {
        canonicalName: "CloudScale Inc",
        typeId: "{{ENTITY_TYPE:COMPANY}}",
        description: "Vendor launching Atlas Edge inference platform",
        aliases: ["CloudScale", "the company"],
      },
      {
        canonicalName: "Atlas Edge",
        typeId: "{{ENTITY_TYPE:PRODUCT}}",
        description: "Managed inference platform for low-latency model hosting",
        aliases: [],
      },
      {
        canonicalName: "RetailNext",
        typeId: "{{ENTITY_TYPE:COMPANY}}",
        description: "Partner co-selling Atlas Edge to grocery chains",
        aliases: [],
      },
    ],
    relations: [
      {
        fromEntityName: "CloudScale Inc",
        toEntityName: "RetailNext",
        relationTypeId: "{{RELATION_TYPE:PARTNER_OF}}",
      },
    ],
    articleMentions: [
      {
        entityName: "CloudScale Inc",
        mentionCount: 5,
        confidence: 0.94,
        sentiment: "POSITIVE",
      },
      {
        entityName: "Atlas Edge",
        mentionCount: 4,
        confidence: 0.91,
        sentiment: "POSITIVE",
      },
      {
        entityName: "RetailNext",
        mentionCount: 2,
        confidence: 0.87,
        sentiment: "NEUTRAL",
      },
    ],
  },
};

/** Curated few-shot extraction exemplars in deterministic archetype order. */
export const DEFAULT_EXTRACTION_EXEMPLARS: readonly ExtractionExemplar[] = [
  earningsExemplar,
  legalExemplar,
  leadershipExemplar,
  productExemplar,
];

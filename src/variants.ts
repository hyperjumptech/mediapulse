import { SUMMARIZE_ARTICLE_SYSTEM_PROMPT } from "../../src/summarize-article.js";

const MATERIALITY_RULE = `
When the article states a figure for the issuer's own results, guidance, or a transaction it is party to, a revenue, a profit, a growth rate, a contract value, a capacity, or a dividend, one of your points must carry that figure. A summary of a results article that names no number has lost the thing the article was reporting. Ambient market data the article mentions in passing, an index level, a policy rate, a sector total, or a peer's result, is not the issuer's own figure and carries no such obligation.`;

const DERIVED_AND_CONVERTED_RULE = `
You may state a ratio you compute from two figures the article prints, such as a profit margin from net income over revenue. Name both inputs in the same point so a reader can check the arithmetic, and round to one decimal place.

When a point carries a rupiah amount and a reference rate is supplied to you below, give the US dollar equivalent in the same point, and name the rate and its date inside that point so a reader can reproduce the conversion. Write it as "Rp1.77 trillion (USD 98.9mn at 17,903/USD, 30 Jun 2026)". Never supply an exchange rate of your own, and never convert when no rate is supplied.`;

const CONDENSED_PROMPT = `You extract the key facts from a single news article for a business newsletter, and you translate its title into English.

Return a title and up to 3 points, each at most 100 characters. Return no points at all when the article carries none worth reporting.

For the title: translate the article's own title faithfully, keeping every number, percentage, currency figure, date, ticker symbol, and proper noun exactly as written. Do not paraphrase or shorten it. Remove any trailing publisher or site name.

Your first duty is the numbers. When the article states a figure for the issuer's own results, guidance, or a transaction it is party to, a point must carry it. A results article summarized without its results has failed. Report the figure with the period it belongs to and the base it moved from when the article gives one. Never move a rate of change onto a different figure, and never pair a quarterly rate with a half-year total.

Your second duty is accuracy. Write only what the article says. Take every point from the body, never from the headline alone. Attribute a claim to whoever made it when the article frames it as one party's account. Name a figure's subject with the article's own term for what was measured, never with the article's topic. When an article reports profit both as the total for the period and as the share attributable to the parent's owners, report the attributable figure and say so.

Every point must carry a number, a name, a date, or a decision. Never write about what the article does not say or leaves unclear. Never pad to three points.

Write in English, Latin alphabet only. One fact per point, no bullet characters, no trailing citations. Never cut a point short to fit the limit: write a shorter complete sentence instead.

Indonesian quantity words carry a magnitude: "belasan" is 11 to 19, "puluhan" is tens, "ratusan" is hundreds, "ribuan" is thousands, "jutaan" is millions. Never make a vague quantity firmer or larger than the source states.`;

export type PromptVariantId = "P0" | "P1" | "P2" | "P3";

export type PromptVariant = {
  id: PromptVariantId;
  label: string;
  summarizerSystemPrompt: string;
  suppliesReferenceRate: boolean;
};

export const PROMPT_VARIANTS: Record<PromptVariantId, PromptVariant> = {
  P0: {
    id: "P0",
    label: "Shipped prompt (control)",
    summarizerSystemPrompt: SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
    suppliesReferenceRate: false,
  },
  P1: {
    id: "P1",
    label: "Shipped + materiality rule",
    summarizerSystemPrompt: `${SUMMARIZE_ARTICLE_SYSTEM_PROMPT}\n${MATERIALITY_RULE}`,
    suppliesReferenceRate: false,
  },
  P2: {
    id: "P2",
    label: "Shipped + materiality + derived/converted figures",
    summarizerSystemPrompt: `${SUMMARIZE_ARTICLE_SYSTEM_PROMPT}\n${MATERIALITY_RULE}\n${DERIVED_AND_CONVERTED_RULE}`,
    suppliesReferenceRate: true,
  },
  P3: {
    id: "P3",
    label: "Condensed rewrite, figures first",
    summarizerSystemPrompt: CONDENSED_PROMPT,
    suppliesReferenceRate: false,
  },
};

export const MODEL_VARIANTS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
] as const;

export type ModelVariantId = (typeof MODEL_VARIANTS)[number];

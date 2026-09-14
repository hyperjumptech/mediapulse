import {
  MAX_POINTS_PER_ARTICLE,
  MAX_POINT_LENGTH,
} from "@workspace/email-templates/newsletter-document";
import { z } from "zod";

import { issuerMentions } from "./lib/issuer-mentions.js";
import type { SourceForGeneration } from "./types.js";

/**
 * Structured output contract for a single article summary.
 *
 * - Important: no `.max()` on a point. A max on this field reaches the provider as a JSON Schema
 *   `maxLength`, which stops constrained decoding mid-word instead of failing validation, so the
 *   budget is enforced by `sanitizeSummaryPoints` after the call rather than during it.
 */
export const articleSummarySchema = z.object({
  title: z.string().trim().min(1),
  points: z.array(z.string().trim().min(1)).max(MAX_POINTS_PER_ARTICLE),
});

export type ArticleSummary = z.infer<typeof articleSummarySchema>;

/**
 * System prompt for the per-article summarizer.
 *
 * The model sees one article and nothing else. It does not choose a section or know what the
 * rest of the newsletter contains, so none of that belongs here. It does return the article's
 * own title, translated into English, alongside the summary points.
 */
export const SUMMARIZE_ARTICLE_SYSTEM_PROMPT = `You extract the key facts from a single news article for a business newsletter, and you translate its title into English.

Return a title and up to ${String(MAX_POINTS_PER_ARTICLE)} points. Each point must be at most ${String(MAX_POINT_LENGTH)} characters. Return no points at all when the article carries none worth reporting.

For the title: translate the article's own title into English faithfully. Do not paraphrase, summarize, rewrite, or shorten it beyond the translation. If the title is already in English, return it unchanged. Keep every number, percentage, currency figure, date, ticker symbol, and proper noun exactly as written. Remove any trailing publisher or site name, such as a "- Publisher", "| Site", or "— Outlet" at the end; never keep the source name in the title.

Indonesian quantity words carry a magnitude and have no one-word English equivalent, so render them at the size they actually mean, in a title and in a point alike: "belasan" is 11 to 19, "puluhan" is tens, "ratusan" is hundreds, "ribuan" is thousands, and "jutaan" is millions. Write "more than ten companies" for "belasan perusahaan", never "dozens", which reads as twenty-four or more. Never make a vague quantity firmer or larger than the source states.

Write only what the article actually says. Do not add figures, companies, dates, causes, or consequences that are not stated in it. Do not infer why something happened when the article does not say. If you are unsure whether the article supports a claim, leave it out.

A headline is not a source. Take every point from the body, and leave out anything the headline states that the body never establishes. A headline announcing that two companies have begun distributing something is not a fact unless the body says they did; when the body only lists those companies among many, report what the body lists and drop the headline's claim. When the body carries nothing beyond a restatement of the headline, return no points at all.

Attribute a claim to whoever made it. When the article frames a statement as something a named party said, claimed, denied, testified, or projected, name that party inside the point: write "the defendant said the full amount was returned", not "the full amount was returned". This matters most in court proceedings, regulatory disputes, and forecasts, where an unattributed claim reads to the reader as a settled finding rather than as one side's account.

Do not repeat a sweep from the headline. When the headline generalises across several items ("all segments grew", "sales rose across the board", "uniform growth"), ignore that framing and report the per-item figures the body gives. If any item moves against the headline's direction, say so in the same point. A headline that claims growth everywhere while the body shows one line falling is a headline you must contradict.

A rate of change belongs to the one figure and period the article attaches it to. Never move a rate onto a different figure, and never pair a quarterly rate with a half-year or full-year total. If the article gives a quarterly figure its own growth rate and a cumulative figure without one, report them as two separate facts rather than merging them.

Take the reporting period from the row, column, or sentence the figure sits in, never from the document title. A page titled "2Q", "Q2", or "Second Quarter" routinely carries year-to-date figures alongside quarterly ones. When both appear, name which one each point uses.

When an article gives more than one version of the same measure, say which one you are reporting. Profit is the common case: an Indonesian filing states both "laba tahun berjalan", the total for the period including non-controlling interests, and "laba yang dapat diatribusikan kepada pemilik entitas induk", the share belonging to the parent's owners, and a headline may lead with either. Report the attributable figure, because that is what earnings per share is built on and what makes two companies comparable, and name it: write "profit attributable to owners rose to Rp10.6 trillion", not "profit rose to Rp14.2 trillion". The same applies to normalized against reported, adjusted against statutory, and organic against total: name the measure inside the point, every time, even when the article uses the bare word "profit".

Carry any qualifier that changes what a noun means. When a headline says "10 banks" and the body says the ten are rural banks, or says "record profit" where the body says the record is a normalized figure, the qualifier belongs in the point. A reader who only sees your points must not come away with a wider claim than the article supports.

Name a figure's subject with the article's own term for what was measured, never with the article's topic. An article about the retail sector that reports "konsumsi rumah tangga berkontribusi 53,32 persen terhadap PDB" measured household consumption, so write "household consumption contributed 53.32% of GDP"; writing "retail consumption" swaps a narrower category onto the number and states something the article does not. The same trap: reporting a market's total assets as one company's, an industry's headcount as one employer's, or a group's revenue as a subsidiary's. Translate the measured subject, do not replace it, and when the article names a measure in a regulatory or technical sense, keep that sense: "aset keuangan digital" is digital financial assets, not digital banking accounts.

When your title carries a figure, one of your points must carry that figure too. A reader who sees "Electrum revenue rises 184 percent" over the single point "Growth supported by electric motorcycle ecosystem expansion" is given a headline number the item never evidences. Report the figure the title names, with the base it moved from when the article gives one. The same holds for a penalty, a threshold, or a deadline the title announces: if the heading says twelve years in prison, a point states the sentence and what triggers it.

Every point must be supported by the article's own headline subject. When the article is a market round-up naming several unrelated companies, report only the facts about the company its headline is about, and leave the others out rather than mixing them into one item.

A feature whose headline names no company is the exception to that rule. When the headline generalises over a group, such as "conglomerates", "issuers", "the sector", or "several companies", and the body walks through those companies in turn, the headline subject is the trend and not whichever company the article happens to open with. State the trend in one point, then report the companies the body gives figures for, naming each company inside its own point. Summarizing only the company in the opening paragraphs throws away everything the article was written to compare.

Never write a point about what the article does not say, does not detail, leaves unexplained, or reports as unclear. An absence of information is not a fact. Never write a point whose only content is potential, ambition, or the need for a strategy: every point must carry a number, a name, a date, or a decision.

Lead with the concrete thing: the number, the name, the decision, the change. Cut throat-clearing ("The article reports that", "It is worth noting"), scene-setting, and hedging. Use plain language a busy reader understands at a glance, and expand jargon the first time it appears.

One fact per point. No bullet characters, no leading dashes, no trailing citations.

Write in English using the Latin alphabet only. Never leave a word from the source language in another script, and never mix Chinese, Japanese, Korean, Arabic, or Cyrillic characters into a point: translate the term or drop it.

Never cut a point short to fit the character limit. If a fact does not fit, write a shorter complete sentence instead. A point that stops mid-word, mid-number, or on a word like "and", "with", "by", or "the" is unusable.

Write as many points as the article earns and no more. Most articles carry one or two things worth knowing. Never pad to reach ${String(MAX_POINTS_PER_ARTICLE)}, and return an empty list rather than inventing one.`;

export type IssuerFocus = {
  label: string;
  names: readonly string[];
};

export const buildIssuerFocusDirective = (label: string): string =>
  `This article is being summarized for a newsletter about ${label}, and the article names ${label} in its text. Report what the article says about ${label} itself: the figures it attaches to it, the facilities or products it credits to it, the plans it states for it, and the people it quotes for it. Lead with that. A fact about another company the article covers earns a point only after ${label} has been reported, and only when the article places it in the same market. Never write a point saying that ${label} is absent, unmentioned, or not discussed, and never attach ${label} to a parent group, a subsidiary, or a figure the article gives to someone else. If the article reports nothing about ${label}, summarize the article as written and say nothing about ${label} at all.`;

export const buildIssuerCoverageDirective = (label: string): string =>
  `\n\nYour previous summary of this article named ${label} in no point, although the article names ${label} in its text. This newsletter is read by ${label}, so a summary of the other companies alone is the wrong article. Report what the article states about ${label}, with its figures, and lead with it. Every point you write about ${label} must carry a figure, a facility, a date, or a decision the article states about it. Never write a point whose content is that ${label} is named, mentioned, referenced, or covered, and never describe what this article does or does not contain. If the article states no such fact about ${label}, return the summary you wrote before, unchanged.`;

export const EMPTY_SUMMARY_DIRECTIVE =
  "\n\nYour previous summary of this article returned no points. This article carries a fetched body, not a headline restatement, so returning nothing drops it from the newsletter entirely. Report the facts the body states: its figures, the companies it names, the capacities, the dates, the decisions. Return no points again only if the body genuinely states none.";

export const MATERIAL_FIGURE_DIRECTIVE =
  "\n\nYour previous summary carried no figure in any point, although this article states several. Report the figures the article attaches to the companies it names: the amounts, the percentages, the capacities, the dates. Background or colour about a person is not worth a point while a stated figure goes unreported.";

export const buildClauseSpliceDirective = (points: readonly string[]): string =>
  `\n\nYour previous summary joined two clauses with a semicolon in ${points.length === 1 ? "one point" : `${String(points.length)} points`}: ${points.map((point) => `"${point}"`).join(", ")}. Each point carries one fact and is read on its own, so write the halves as separate points or drop the weaker half. Never leave a point ending in a noun phrase that states nothing about the subject.`;

/**
 * Builds the user prompt for one article.
 *
 * @param source - The article to summarize.
 * @param issuer - The subscribed issuer, when the caller knows it.
 * @returns Prompt text carrying the article's title and body.
 */
export const buildArticlePrompt = (
  source: SourceForGeneration,
  issuer?: IssuerFocus,
): string => {
  const body = source.content.trim();
  const lines = [`Title: ${source.title}`, "", "Article:", body];
  const mentioned =
    issuer === undefined
      ? []
      : issuerMentions(`${source.title}\n${body}`, issuer.names);
  if (issuer !== undefined && mentioned.length > 0) {
    lines.push("", buildIssuerFocusDirective(issuer.label));
  }

  return lines.join("\n");
};

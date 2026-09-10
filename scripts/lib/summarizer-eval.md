# Summarizer eval

Runner: `scripts/eval-summarizer.mjs`, helpers in `scripts/lib/summarizer-eval.mjs`, cases in
`scripts/lib/summarizer.cases.json`. It lives in `scripts/` for the same reason as the
section-placement eval: it reads credentials from the environment, and `@mediapulse/env` would
demand a database URL and every integration secret just to run an eval.

Measures whether the per-article summarizer writes bullets a reader gains something from, and
whether it stays quiet when the source gives it nothing.

## Why it exists

On 2026-09-09 an Industry Pulse item shipped carrying one bullet that restated its own headline.
The article body had never been fetched, so the summarizer had 150 characters of description and
nothing else. The prompt already covers that case:

> When the body carries nothing beyond a restatement of the headline, return no points at all.

The correct output was an empty list. The model wrote a bullet anyway. Roughly 31% of shipped items
are summarized from the description alone, so how a model behaves on thin input is not an edge
case, it is a third of the newsletter.

## Running it

```bash
OPENROUTER_API_KEY=... pnpm eval:summarizer
OPENROUTER_API_KEY=... pnpm eval:summarizer --models qwen/qwen3.5-flash-02-23,deepseek/deepseek-v4-flash
OPENROUTER_API_KEY=... pnpm eval:summarizer --json report.json
OPENROUTER_API_KEY=... pnpm eval:summarizer --no-cache
```

Responses are cached on disk under `.eval-cache/summarizer`, keyed by model, prompt and decoding
settings. A repeat run makes no network calls at all, and adding one model to a comparison pays
only for that model. Editing the production prompt invalidates every entry automatically, because
the prompt text is part of the key. Use `--no-cache` only when checking a provider for
non-determinism.

The prompt and the limits are imported from the agent, never copied: `SUMMARIZE_ARTICLE_SYSTEM_PROMPT`
and `buildArticlePrompt` from content-generation, `MAX_POINTS_PER_ARTICLE` and `MAX_POINT_LENGTH`
from the newsletter document contract. A prompt change is reflected here on the next run with no
edit to the eval.

## The two arms

**Description-only** (40 cases). Articles whose stored `content` is empty, so the collection-time
description is the entire input, median 151 characters. 22 of them are labelled `restatementOnly`:
their description adds nothing to the headline, so the only correct answer is no points. Every
bullet a model writes on those 22 is a bullet that should never have reached a reader. The other
18 carry at least one fact, and bullets there are legitimate, which is why the report counts the
two separately: a model that simply never speaks would score perfectly on restraint alone.

**Body** (20 cases). Articles carrying real text, truncated to 8,000 characters to match
content-generation's `truncation.maxCharsPerSource`. Judged on how much substance the model gets
out, plus structure and figures.

## What is scored automatically

- **Restraint** — of the `restatementOnly` cases, how many returned no points.
- **Spurious points** — bullets written from those same cases.
- **Thin-source points** — bullets from descriptions that do carry a fact. Read alongside
  restraint: a high restraint score with a low count here means the model is silent, not careful.
- **Body points** — total and per article.
- **Structure** — points past `MAX_POINT_LENGTH`, more than `MAX_POINTS_PER_ARTICLE`, leading
  bullet characters, non-Latin characters. Over-length is not fatal in production:
  `sanitizeSummaryPoints` clips at a clause boundary, so the bullet ships with its tail cut off.
- **Figures to check** — every number in a bullet that does not appear in its source.
- **Transport failures** — requests that never produced a parseable answer.
- **Cost** — as billed, taken from the provider's usage field.

## What is not scored automatically

Whether a bullet is worth reading. Density, attribution, whether the model picked the most
important fact, whether it obeyed the round-up rule. Read the outputs before preferring one model
on substance; the runner prints that reminder for the same reason.

A figure flag is a prompt to look, not a verdict. Indonesian sources write `US$ 16.733,33` where an
English bullet writes `16,733.33`, and `numericVariants` accepts both, but a figure the model
computed correctly from two numbers in the source will still flag.

## Reading a result

Restraint separates models sharply and is the number to lead with. On the current cases,
`openai/gpt-4.1-mini` returns no points on 7 of 22, `deepseek/deepseek-v4-flash` on 11, and
`qwen/qwen3.5-flash-02-23` on 15. A one-case difference is noise at this sample size; the spread
between 7 and 15 is not.

Do not carry a model over from the classifier eval on its score there. `google/gemini-2.5-flash-lite`
has the best recall in `eval:section-placement` and never once returns an empty list here. The two
jobs reward opposite dispositions, and Hermes keeps `ARTICLE_ANALYSIS_MODEL` and
`CONTENT_GENERATION_MODEL` as separate variables so they can differ.

## Refreshing the cases

The cases are a frozen sample of items that shipped in a 21-day window, with `restatementOnly`
labelled by hand. They are checked in so a run is reproducible without touching the production
database. Re-sample only when the corpus has moved enough to matter, and re-label by reading each
description against its headline: the label is a judgement, not something to infer with a model.

# Section-placement eval

Measures how often the classifier puts a real article in the section it belongs to.

## Why it exists

Re-running article-analysis over the same corpus moves 15-25% of articles between sections, so a
single before/after comparison cannot tell a real improvement from noise. Every rule-text change,
gate change, or model change needs a same-code baseline first.

## Running it

```bash
OPENROUTER_API_KEY=... pnpm --filter @mediapulse/article-analysis eval:section
```

Optional environment:

| Variable              | Default                        | Purpose                         |
| --------------------- | ------------------------------ | ------------------------------- |
| `EVAL_MODEL`          | `openai/gpt-4o-mini`           | Any OpenRouter model id         |
| `EVAL_REPEATS`        | `1`                            | Repeat runs to measure variance |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint      |

Use `EVAL_REPEATS=3` or more before and after a change. A change is only meaningful if it moves the
mean beyond the baseline range.

## The cases

`section-placement.cases.json` holds 20 real articles from the 2026-08-21 batch, each labelled with
the section it should have reached. Labels come from the hand review in `reviews/2026-08-21/`:
confirmed misplacements, confirmed wrongly-rejected articles, and correctly-placed items kept as
regression guards. `expectedSection: null` means the article should be rejected.

Nine of the twenty carry no body text. That is not a fixture defect: most collected sources have no
body, so the eval reproduces the condition the classifier actually works under.

## Baseline

`openai/gpt-4o-mini`, 3 runs, unchanged code:

```
mean accuracy: 46.7%  range: 40.0%-55.0%
```

The 15-point spread across identical inputs is the measurement problem this eval exists to expose.
Treat the range, not the mean, as the bar to clear.

- Important: this baseline is model-specific. Production reads its model from the Hermes agent
  config (`{{AI_MODEL}}`), so re-baseline with `EVAL_MODEL` set to whatever production runs before
  drawing conclusions about production.

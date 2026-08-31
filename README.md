# Content-generation eval harness

Replays real historical content-generation runs against a fixed corpus so a model or prompt change can be measured instead of argued about.

A case is a real `(ticker, run timestamp)` pair from a shipped newsletter. The candidate pool is reconstructed by injecting `now` into the pool query, and the fetch step is stubbed to the article text already stored, so no paid fetch fires and every repeat sees identical input. Every summarizer response is captured before the output guards run, which is what lets a missing figure be attributed to selection, to the model, or to a guard that deleted it.

## Setup

The corpus and results are deliberately not stored here. `corpus/` holds third-party publisher text, and both directories regenerate.

```bash
export MEDIAPULSE_DATABASE_URL=...   # read-only use
export OPENROUTER_API_KEY=...

mkdir -p corpus results
psql "$MEDIAPULSE_DATABASE_URL" -A -t -f build-corpus.sql > corpus/cases.json
```

`build-corpus.sql` selects 30 runs stratified by candidate-pool size and by whether the shipped issue already dropped a figure, and captures each run's pool, issuer aliases, competitors, product brief, and the recent bullets used for cross-day dedup, so a replay matches production.

## Running

```bash
bun run run-stage1.ts        # four models on the shipped prompt
bun run run-stage2.ts        # surviving models across prompt variants
bun run run-after-corpus.ts  # one cell, for verifying a code change
bun run summarize.ts ./results/stage1.jsonl

bun run run-beforeafter.ts ./results/before.json            # one article, current code
REPEATS=12 bun run run-beforeafter.ts ./results/after.json --joined
```

Runs append to JSONL and skip work already present, so an interrupted sweep resumes rather than re-spending.

## Reading the numbers

Coverage is Material Figures reaching the reader over those in articles the issue actually selected. The plain pool-wide coverage is reported too but is mostly context: a pool of fifty candidates competes for four or five slots, so most non-selection is by design.

Every cell's coverage is also recomputed per repeat index. The spread between those numbers is the noise floor, and a gap between two cells narrower than it is not a result.

Two traps worth knowing. Coverage alone rewards cramming several figures into one point, so always read it alongside points shipped: a variant scoring higher on 37% fewer points is not better. And an assertion is generated, never hand-reviewed, so a surprising verdict should be checked against the sentence the extractor pulled the figure from before it is believed.

## Reports

```bash
EVAL_LOG_DIR=<dir with stage logs> bun run src/export-report.ts --stage2
bun run src/build-report.ts        # results/report.html
bun run src/build-beforeafter.ts   # results/before-after.html
```

import { readFileSync, writeFileSync } from "node:fs";

type Cell = {
  model: string;
  promptVariant: string;
  runs: number;
  failedRuns: number;
  figuresTotal: number;
  carried: number;
  coverage: number;
  selectedCoverage: number;
  verdicts: Record<string, number>;
  violations: Record<string, number>;
  violationsPerPoint: number;
  shippedPoints: number;
  coverageByRepeat: number[];
  coverageSpread: number;
};

type ReportData = {
  generatedAt: string;
  attrition: {
    pointsUngrounded: number;
    pointsUnusable: number;
    pointsRepeated: number;
    articlesTitleFigure: number;
    articlesNoRelation: number;
    unusableReasons: Record<string, number>;
    shippedPoints: number;
    deletedPoints: number;
    deletionRate: number;
  };
  corpus: {
    cases: number;
    poolArticles: number;
    articlesWithContent: number;
    strata: Record<string, number>;
  };
  stages: {
    stage: string;
    cells: Cell[];
    violations: { code: string; count: number }[];
  }[];
  drilldown: {
    caseId: string;
    symbol: string;
    stratum: string;
    runAt: string;
    poolSize: number;
    shippedSubject: string;
    shippedItems: { title: string; points: string[] }[];
    articles: {
      title: string;
      url: string;
      section: string | null;
      excerpt: string;
      materialFigures: { raw: string; sentence: string }[];
    }[];
    perCell: {
      model: string;
      promptVariant: string;
      status: string;
      carried: number;
      figuresTotal: number;
      figures: { raw: string; articleTitle: string; verdict: string }[];
      violations: { code: string; point: string; detail: string }[];
    }[];
  }[];
};

const escape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const percent = (value: number, digits = 1): string =>
  `${(value * 100).toFixed(digits)}%`;

const MODEL_LABEL: Record<string, string> = {
  "openai/gpt-4.1-mini": "gpt-4.1-mini",
  "openai/gpt-4.1-nano": "gpt-4.1-nano",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
};

const PROMPT_LABEL: Record<string, string> = {
  P0: "P0 shipped",
  P1: "P1 + materiality",
  P2: "P2 + derived/converted",
  P3: "P3 condensed",
};

const VERDICT_LABEL: Record<string, string> = {
  carried: "Carried to the reader",
  guard_dropped: "Written, then deleted by a guard",
  not_written: "Never written by the model",
  not_selected: "Article never selected",
};

const VIOLATION_LABEL: Record<string, string> = {
  F1_ungrounded: "Figure not in the article",
  F2_conversion_unsourced: "Converted amount with no rate or date",
  F3_arithmetic_wrong: "Conversion does not reproduce",
  F4_truncated: "Point ends on a stopword",
  F5_non_latin: "Non-Latin script",
  F6_vacuous: "No number, name, or decision",
  F7_over_length: "Over the 100-character limit",
};

const REASON_LABEL: Record<string, string> = {
  truncated: "Cut off mid-thought",
  figure_without_subject: "Figure with no subject",
  no_substance: "No substance",
  non_latin_script: "Non-Latin script",
  starts_mid_sentence: "Starts mid-sentence",
  max_output_tokens: "Hit the output token cap",
  fetch_failure: "Fetch failure",
};

const STRATUM_LABEL: Record<string, string> = {
  dcii: "DCII, the reported case",
  big_pool: "Large candidate pool",
  mid_pool: "Mid candidate pool",
  figure_drop: "Shipped with a figure missing",
};

const verdictBar = (verdicts: Record<string, number>): string => {
  const order = ["carried", "guard_dropped", "not_written", "not_selected"];
  const total = order.reduce((sum, key) => sum + (verdicts[key] ?? 0), 0);
  if (total === 0) {
    return "";
  }
  const segments = order
    .map((key) => {
      const count = verdicts[key] ?? 0;
      if (count === 0) {
        return "";
      }

      return `<span class="seg seg-${key}" style="flex:${String(count)}" title="${escape(VERDICT_LABEL[key] ?? key)}: ${String(count)}"></span>`;
    })
    .join("");

  return `<div class="bar">${segments}</div>`;
};

const cellRows = (cells: Cell[]): string =>
  cells
    .map((cell) => {
      const spreadFlag =
        cell.coverageSpread > 0.02 ? ' <span class="flag">noisy</span>' : "";
      const failFlag =
        cell.failedRuns > cell.runs * 0.1
          ? ` <span class="flag flag-bad">${String(cell.failedRuns)} runs failed</span>`
          : "";

      return `<tr>
      <td class="name">${escape(MODEL_LABEL[cell.model] ?? cell.model)}${failFlag}</td>
      <td class="name dim">${escape(PROMPT_LABEL[cell.promptVariant] ?? cell.promptVariant)}</td>
      <td class="num strong">${percent(cell.selectedCoverage)}</td>
      <td class="num dim">${String(cell.carried)}/${String(cell.verdicts.carried + cell.verdicts.not_written + cell.verdicts.guard_dropped)}</td>
      <td class="num">${(cell.coverageSpread * 100).toFixed(1)}pp${spreadFlag}</td>
      <td class="num">${String(cell.verdicts.not_written ?? 0)}</td>
      <td class="num">${String(cell.verdicts.guard_dropped ?? 0)}</td>
      <td class="num">${cell.violationsPerPoint.toFixed(3)}</td>
      <td class="barcell">${verdictBar(cell.verdicts)}</td>
    </tr>`;
    })
    .join("\n");

const scoreboard = (title: string, note: string, cells: Cell[]): string => `
  <section class="block">
    <h2>${escape(title)}</h2>
    <p class="note">${note}</p>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Model</th><th>Prompt</th><th class="num">Coverage</th><th class="num">Carried</th>
            <th class="num">Spread</th><th class="num">Not written</th><th class="num">Guard-dropped</th>
            <th class="num">Violations/pt</th><th>Where the figures went</th>
          </tr>
        </thead>
        <tbody>${cellRows(cells)}</tbody>
      </table>
    </div>
  </section>`;

const drilldownSection = (data: ReportData): string => {
  const cards = data.drilldown
    .map((entry) => {
      const figuresList = entry.articles
        .map(
          (article) => `
        <div class="article">
          <div class="article-title">${escape(article.title)}</div>
          <div class="chips">${article.materialFigures
            .map((figure) => `<span class="chip">${escape(figure.raw)}</span>`)
            .join("")}</div>
          <p class="excerpt">${escape(article.excerpt)}</p>
        </div>`,
        )
        .join("");

      const cellRowsHtml = entry.perCell
        .map((cell) => {
          const verdicts = cell.figures
            .map(
              (figure) =>
                `<span class="vchip v-${figure.verdict}" title="${escape(VERDICT_LABEL[figure.verdict] ?? figure.verdict)}">${escape(figure.raw)}</span>`,
            )
            .join("");
          const violations = cell.violations
            .map(
              (violation) =>
                `<li><span class="vcode">${escape(VIOLATION_LABEL[violation.code] ?? violation.code)}</span> ${escape(violation.point)}</li>`,
            )
            .join("");

          return `<tr>
          <td class="name">${escape(MODEL_LABEL[cell.model] ?? cell.model)}</td>
          <td class="name dim">${escape(cell.promptVariant)}</td>
          <td class="num">${String(cell.carried)}/${String(cell.figuresTotal)}</td>
          <td>${verdicts}${violations === "" ? "" : `<ul class="viol">${violations}</ul>`}</td>
        </tr>`;
        })
        .join("");

      const shipped = entry.shippedItems
        .map(
          (item) =>
            `<li><strong>${escape(item.title)}</strong>${
              item.points.length === 0
                ? ""
                : `<ul>${item.points.map((point) => `<li>${escape(point)}</li>`).join("")}</ul>`
            }</li>`,
        )
        .join("");

      return `
      <details class="case">
        <summary>
          <span class="sym">${escape(entry.symbol)}</span>
          <span class="date">${escape(entry.runAt.slice(0, 10))}</span>
          <span class="stratum">${escape(STRATUM_LABEL[entry.stratum] ?? entry.stratum)}</span>
          <span class="pool">pool ${String(entry.poolSize)}</span>
        </summary>
        <div class="case-body">
          <h4>Material Figures the articles state</h4>
          ${figuresList === "" ? '<p class="note">No article in this pool states a figure about the issuer.</p>' : figuresList}
          <h4>What each variant did with them</h4>
          <div class="scroll">
            <table class="inner">
              <thead><tr><th>Model</th><th>Prompt</th><th class="num">Carried</th><th>Per-figure verdict</th></tr></thead>
              <tbody>${cellRowsHtml}</tbody>
            </table>
          </div>
          <h4>What actually shipped that day</h4>
          <p class="note subject">${escape(entry.shippedSubject)}</p>
          <ul class="shipped">${shipped}</ul>
        </div>
      </details>`;
    })
    .join("");

  return `<section class="block">
    <h2>Every case, and every figure in it</h2>
    <p class="note">Assertions are generated, not hand-reviewed, so each case shows the figures the extractor found next to the article text it found them in. A verdict you disagree with is checkable here.</p>
    ${cards}
  </section>`;
};

export const buildReport = (data: ReportData): string => {
  const stage1 = data.stages.find((entry) => entry.stage === "stage1");
  const stage2 = data.stages.find((entry) => entry.stage === "stage2");
  const allCells = data.stages.flatMap((entry) => entry.cells);
  const best = [...allCells].sort(
    (left, right) => right.selectedCoverage - left.selectedCoverage,
  )[0];
  const control = stage1?.cells.find(
    (cell) => cell.model === "openai/gpt-4.1-mini",
  );
  const noiseFloor = Math.max(
    ...allCells.map((cell) => cell.coverageSpread),
    0,
  );

  const reasonRows = Object.entries(data.attrition.unusableReasons)
    .sort((left, right) => right[1] - left[1])
    .map(
      ([reason, count]) =>
        `<tr><td>${escape(REASON_LABEL[reason] ?? reason)}</td><td class="num">${String(count)}</td></tr>`,
    )
    .join("");

  return `<title>Where the Figures Go</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
:root{
  --ground:#F4F6F8; --surface:#FFFFFF; --sunken:#EDF0F3;
  --ink:#171B21; --ink-2:#464F5B; --ink-3:#79828F;
  --line:#DCE1E7; --line-2:#C6CDD6;
  --accent:#0C6E7C; --accent-soft:#DCEEF1;
  --carried:#1F7355; --guard:#A96608; --notwritten:#A4392A; --notselected:#8A929D;
  --bad-bg:#FBE9E6; --warn-bg:#FBF1DF;
  --shadow:0 1px 2px rgba(23,27,33,.06),0 8px 24px -16px rgba(23,27,33,.24);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#0E1116; --surface:#161B22; --sunken:#1C222B;
    --ink:#E8ECF1; --ink-2:#A9B3BF; --ink-3:#79838F;
    --line:#252C36; --line-2:#333C48;
    --accent:#4CC2D2; --accent-soft:#12313A;
    --carried:#4FBE92; --guard:#E0A03C; --notwritten:#E27A68; --notselected:#79838F;
    --bad-bg:#2A1714; --warn-bg:#2A2113;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -16px rgba(0,0,0,.8);
  }
}
:root[data-theme="dark"]{
  --ground:#0E1116; --surface:#161B22; --sunken:#1C222B;
  --ink:#E8ECF1; --ink-2:#A9B3BF; --ink-3:#79838F;
  --line:#252C36; --line-2:#333C48;
  --accent:#4CC2D2; --accent-soft:#12313A;
  --carried:#4FBE92; --guard:#E0A03C; --notwritten:#E27A68; --notselected:#79838F;
  --bad-bg:#2A1714; --warn-bg:#2A2113;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -16px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;
  font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:56px 24px 96px;display:flex;flex-direction:column;gap:44px}
h1,h2,h3,h4{font-family:"Bricolage Grotesque","IBM Plex Sans",sans-serif;text-wrap:balance;margin:0}
h1{font-size:clamp(34px,5.2vw,52px);font-weight:700;letter-spacing:-.022em;line-height:1.05}
h2{font-size:23px;font-weight:600;letter-spacing:-.012em}
h4{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);margin-top:22px}
p{margin:0}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.lede{font-size:18px;line-height:1.62;color:var(--ink-2);max-width:64ch;margin-top:16px}
.note{color:var(--ink-2);font-size:14px;max-width:72ch;margin-top:6px}
.block{display:flex;flex-direction:column;gap:12px}
.meta{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-3);border-top:1px solid var(--line);padding-top:14px;
  display:flex;flex-wrap:wrap;gap:18px}
.band{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:20px 22px;box-shadow:var(--shadow);
  display:flex;flex-direction:column;gap:6px}
.stat .k{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.stat .v{font-family:"Bricolage Grotesque",sans-serif;font-size:39px;font-weight:700;line-height:1;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums}
.stat .d{font-size:13px;color:var(--ink-2);line-height:1.45}
.stat.alarm .v{color:var(--notwritten)}
.stat.good .v{color:var(--carried)}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:3px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{text-align:left;font-weight:600;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);
  padding:11px 13px;border-bottom:1px solid var(--line-2);white-space:nowrap;background:var(--sunken)}
td{padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
.num{text-align:right;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.strong{font-weight:600;font-size:14.5px}
.name{font-family:"IBM Plex Mono",monospace;font-size:12.5px;white-space:nowrap}
.dim{color:var(--ink-2)}
.flag{font-family:"IBM Plex Sans",sans-serif;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;
  background:var(--warn-bg);color:var(--guard);padding:2px 6px;border-radius:2px;margin-left:6px}
.flag-bad{background:var(--bad-bg);color:var(--notwritten)}
.barcell{width:190px;min-width:150px}
.bar{display:flex;height:9px;border-radius:2px;overflow:hidden;background:var(--sunken)}
.seg-carried{background:var(--carried)}
.seg-guard_dropped{background:var(--guard)}
.seg-not_written{background:var(--notwritten)}
.seg-not_selected{background:var(--notselected);opacity:.42}
.legend{display:flex;flex-wrap:wrap;gap:16px;font-size:12.5px;color:var(--ink-2);margin-top:4px}
.legend span{display:flex;align-items:center;gap:7px}
.dot{width:10px;height:10px;border-radius:2px;display:inline-block}
.case{background:var(--surface);border:1px solid var(--line);border-radius:3px;margin-top:8px}
.case[open]{box-shadow:var(--shadow)}
.case summary{cursor:pointer;padding:13px 16px;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;
  font-size:13.5px;list-style:none}
.case summary::-webkit-details-marker{display:none}
.case summary::before{content:"+";font-family:"IBM Plex Mono",monospace;color:var(--accent);font-weight:600}
.case[open] summary::before{content:"\\2212"}
.case summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.sym{font-family:"IBM Plex Mono",monospace;font-weight:600}
.date{font-family:"IBM Plex Mono",monospace;color:var(--ink-3);font-size:12.5px}
.stratum{color:var(--ink-2)}
.pool{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-3)}
.case-body{padding:0 16px 20px;border-top:1px solid var(--line)}
.article{border-left:2px solid var(--line-2);padding:2px 0 2px 13px;margin:10px 0}
.article-title{font-weight:500;font-size:13.5px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
.chip{font-family:"IBM Plex Mono",monospace;font-size:11.5px;background:var(--accent-soft);color:var(--accent);
  padding:2px 7px;border-radius:2px}
.excerpt{font-size:12.5px;color:var(--ink-3);line-height:1.5;max-width:76ch}
.vchip{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:11.5px;padding:2px 7px;border-radius:2px;
  margin:0 5px 5px 0;border:1px solid transparent}
.v-carried{background:var(--accent-soft);color:var(--carried);border-color:var(--carried)}
.v-guard_dropped{background:var(--warn-bg);color:var(--guard);border-color:var(--guard)}
.v-not_written{background:var(--bad-bg);color:var(--notwritten);border-color:var(--notwritten)}
.v-not_selected{color:var(--notselected);border-color:var(--line-2)}
.viol{margin:6px 0 0;padding-left:16px;font-size:12px;color:var(--ink-2)}
.vcode{font-family:"IBM Plex Mono",monospace;color:var(--guard)}
.shipped{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--ink-2)}
.shipped ul{padding-left:16px;margin:4px 0}
.subject{font-family:"IBM Plex Mono",monospace;font-size:12.5px}
table.inner{font-size:12.5px}
.finding{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:3px;
  padding:18px 20px;display:flex;flex-direction:column;gap:8px}
.finding h3{font-size:16px;font-weight:600}
.finding p{font-size:14px;color:var(--ink-2);max-width:74ch}
.findings{display:flex;flex-direction:column;gap:12px}
code{font-family:"IBM Plex Mono",monospace;font-size:12.5px;background:var(--sunken);padding:1px 5px;border-radius:2px}
@media (max-width:640px){.wrap{padding:36px 16px 64px;gap:34px}.stat .v{font-size:32px}}
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Mediapulse / content generation</div>
    <h1>Where the figures go</h1>
    <p class="lede">A newsletter cited an article stating Rp1.77 trillion of revenue and shipped a summary carrying no number at all. This replays 30 real runs across four models and four prompts to find out where, between the article and the reader, the figures are lost.</p>
    <div class="meta">
      <span>${data.corpus.cases} cases</span>
      <span>${data.corpus.poolArticles} pool articles</span>
      <span>${data.corpus.articlesWithContent} with body text</span>
      <span>${allCells.reduce((sum, cell) => sum + cell.runs, 0)} replays</span>
      <span>${escape(data.generatedAt.slice(0, 10))}</span>
    </div>
  </header>

  <section class="band">
    <div class="stat alarm">
      <span class="k">Generated, then deleted</span>
      <span class="v">${percent(data.attrition.deletionRate, 0)}</span>
      <span class="d">${data.attrition.deletedPoints.toLocaleString("en-US")} of the points the models wrote never reached a reader. ${data.attrition.shippedPoints.toLocaleString("en-US")} shipped.</span>
    </div>
    <div class="stat">
      <span class="k">Best figure coverage</span>
      <span class="v">${best === undefined ? "n/a" : percent(best.selectedCoverage, 0)}</span>
      <span class="d">${best === undefined ? "" : `${escape(MODEL_LABEL[best.model] ?? best.model)} on ${escape(PROMPT_LABEL[best.promptVariant] ?? best.promptVariant)}. Of the figures in articles that were selected, this share reached the reader.`}</span>
    </div>
    <div class="stat good">
      <span class="k">Measurement noise floor</span>
      <span class="v">${(noiseFloor * 100).toFixed(1)}pp</span>
      <span class="d">Widest spread between repeats of an identical cell. Any gap narrower than this is not a result.</span>
    </div>
  </section>

  <section class="block">
    <h2>What this found</h2>
    <div class="findings">
      <div class="finding">
        <h3>The models are not the bottleneck. The guards are.</h3>
        <p>Across every stage-1 replay the output guards deleted ${data.attrition.pointsUngrounded.toLocaleString("en-US")} points for citing a figure absent from the article, ${data.attrition.pointsUnusable.toLocaleString("en-US")} as unusable, and ${data.attrition.pointsRepeated.toLocaleString("en-US")} as repeated claims, and threw away ${String(data.attrition.articlesTitleFigure)} whole articles over a title figure and ${String(data.attrition.articlesNoRelation)} more for having no point that related to their own heading. Changing the model moves coverage by a few points. This moves it by ${percent(data.attrition.deletionRate, 0)}.</p>
      </div>
      <div class="finding">
        <h3>The reported DCII failure does not reproduce.</h3>
        <p>Replayed against the same article, every one of the four models carried both Rp1.77 trillion and Rp732.5 billion under the shipped prompt. The production run that dropped them was variance, not incapacity. Separately, the article was ingested twice, as page 1 and page 2, and from 30 August the newsletter cited page 2, which states no financial figures at all.</p>
      </div>
      <div class="finding">
        <h3>Cutting points off is the single largest quality defect.</h3>
        <p>${String(data.attrition.unusableReasons.truncated ?? 0)} points were discarded for stopping mid-thought, more than every other unusable reason combined. The prompt already forbids it in as many words. The 100-character limit is the more likely cause.</p>
      </div>
      <div class="finding">
        <h3>gemini-2.5-flash cannot hold the schema.</h3>
        <p>It failed ${String(stage1?.cells.find((cell) => cell.model === "google/gemini-2.5-flash")?.failedRuns ?? 0)} of 90 runs with <code>NoObjectGeneratedError</code>, unable to return the structured summary shape through OpenRouter. Its coverage number is computed over too few surviving figures to compare. It is not a viable swap at any price.</p>
      </div>
    </div>
  </section>

  ${stage1 === undefined ? "" : scoreboard("Stage 1: four models on the shipped prompt", "Coverage is Material Figures carried to the reader over Material Figures in the articles selection actually shipped. Spread is the gap between identical repeats: read every difference against it.", stage1.cells)}

  ${stage2 === undefined ? "" : scoreboard("Stage 2: the two surviving models across three prompts", "P0 cannot carry converted figures by construction, so conversion is never folded into coverage. P2 is the only variant given a reference rate.", stage2.cells)}

  <section class="block">
    <div class="legend">
      <span><i class="dot" style="background:var(--carried)"></i>Carried to the reader</span>
      <span><i class="dot" style="background:var(--guard)"></i>Written, then deleted by a guard</span>
      <span><i class="dot" style="background:var(--notwritten)"></i>Never written by the model</span>
      <span><i class="dot" style="background:var(--notselected);opacity:.42"></i>Article never selected</span>
    </div>
    <p class="note">Most figures sit in articles that were never selected, and most of that is by design: a pool of fifty candidates competes for four or five slots. That column is context, not a defect count. The two that are defects are the middle pair.</p>
  </section>

  <section class="block">
    <h2>Why points were discarded as unusable</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Reason</th><th class="num">Points</th></tr></thead>
        <tbody>${reasonRows}</tbody>
      </table>
    </div>
  </section>

  ${drilldownSection(data)}

  <section class="block">
    <h2>How to read this, and what it does not show</h2>
    <p class="note">Each case is a real historical run, replayed by pinning the candidate pool to a snapshot and injecting the run's own timestamp, with the fetch step stubbed to the article text already stored. No paid fetch fires, so every repeat sees identical input and a difference between cells is a difference in the model or the prompt. Cross-day dedup, the product brief, competitors and issuer aliases are all supplied as production supplies them.</p>
    <p class="note">Assertions are generated by an extractor, not reviewed by a person. It marks a figure material when the article is about the issuer, by its title or opening sentences, and the sentence carrying the figure names a result, guidance, or a transaction. It will be wrong in both directions on some articles, which is why every case above shows the sentence each figure came from.</p>
    <p class="note">Three things this cannot tell you. Whether an unselected article should have been selected, because it scores selection only by what the figures did. Whether a summary reads well, because nothing here is a judgement of prose. And whether a better model than these four clears the bar, because the matrix was deliberately limited to models at or below the cost of the one in production.</p>
  </section>
</div>`;
};

if (import.meta.main) {
  const data = JSON.parse(
    readFileSync("./results/report-data.json", "utf8"),
  ) as ReportData;
  writeFileSync("./results/report.html", buildReport(data));
  console.log("wrote results/report.html");
}

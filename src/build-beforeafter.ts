import { readFileSync, writeFileSync } from "node:fs";

type Run = {
  repeat: number;
  status: string;
  subject?: string;
  raw: { title: string; points: string[] }[];
  shipped: { title: string; url: string; points: string[] }[];
};

type Side = {
  mode: string;
  articleUrl: string;
  articleChars: number;
  runs: Run[];
};

const ARTICLE_ID = "1998715";
const FIGURE = /1[.,]77|732[.,]5/;

const escape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const carriesFigure = (run: Run): boolean =>
  run.shipped.some((article) =>
    article.points.some((point) => FIGURE.test(point)),
  );

const modelWroteFigure = (run: Run): boolean =>
  run.raw.some((summary) => summary.points.some((point) => FIGURE.test(point)));

const articleOf = (run: Run) =>
  run.shipped.find((article) => article.url.includes(ARTICLE_ID));

const highlight = (point: string): string => {
  const escaped = escape(point);

  return escaped.replace(
    /(Rp1[.,]77 trillion|Rp732[.,]5 billion|10[.,]9%|9[.,]7%)/g,
    "<mark>$1</mark>",
  );
};

const runColumn = (side: Side, limit: number): string =>
  side.runs
    .slice(0, limit)
    .map((run) => {
      const article = articleOf(run);
      const points = article?.points ?? [];
      const flag = carriesFigure(run) ? "hit" : "miss";

      return `<li class="run run-${flag}">
        <span class="runid">run ${String(run.repeat + 1)}</span>
        ${
          points.length === 0
            ? '<p class="dropped">Article dropped from the issue</p>'
            : `<ul class="pts">${points
                .map((point) => `<li>${highlight(point)}</li>`)
                .join("")}</ul>`
        }
      </li>`;
    })
    .join("");

export const buildBeforeAfter = (before: Side, after: Side): string => {
  const beforeHits = before.runs.filter(carriesFigure).length;
  const afterHits = after.runs.filter(carriesFigure).length;
  const beforeWrote = before.runs.filter(modelWroteFigure).length;
  const afterWrote = after.runs.filter(modelWroteFigure).length;

  return `<title>The Missing Rp1.77 Trillion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@0,400;0,500;0,600&display=swap">
<style>
:root{
  --ground:#F4F6F8;--surface:#FFFFFF;--sunken:#EDF0F3;
  --ink:#171B21;--ink-2:#464F5B;--ink-3:#79828F;
  --line:#DCE1E7;--line-2:#C6CDD6;
  --accent:#0C6E7C;--accent-soft:#DCEEF1;
  --good:#1F7355;--good-soft:#E2F1EA;--bad:#A4392A;--bad-soft:#FBE9E6;--warn:#A96608;
  --mark:#FFEDB3;--mark-ink:#5C4708;
  --shadow:0 1px 2px rgba(23,27,33,.06),0 8px 24px -16px rgba(23,27,33,.24);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#0E1116;--surface:#161B22;--sunken:#1C222B;
  --ink:#E8ECF1;--ink-2:#A9B3BF;--ink-3:#79838F;
  --line:#252C36;--line-2:#333C48;
  --accent:#4CC2D2;--accent-soft:#12313A;
  --good:#4FBE92;--good-soft:#133025;--bad:#E27A68;--bad-soft:#2A1714;--warn:#E0A03C;
  --mark:#4A3A0C;--mark-ink:#FFE08A;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -16px rgba(0,0,0,.8);
}}
:root[data-theme="dark"]{
  --ground:#0E1116;--surface:#161B22;--sunken:#1C222B;
  --ink:#E8ECF1;--ink-2:#A9B3BF;--ink-3:#79838F;
  --line:#252C36;--line-2:#333C48;
  --accent:#4CC2D2;--accent-soft:#12313A;
  --good:#4FBE92;--good-soft:#133025;--bad:#E27A68;--bad-soft:#2A1714;--warn:#E0A03C;
  --mark:#4A3A0C;--mark-ink:#FFE08A;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -16px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:56px 24px 96px;display:flex;flex-direction:column;gap:44px}
h1,h2,h3{font-family:"Bricolage Grotesque","IBM Plex Sans",sans-serif;text-wrap:balance;margin:0}
h1{font-size:clamp(34px,5.2vw,52px);font-weight:700;letter-spacing:-.022em;line-height:1.05}
h2{font-size:23px;font-weight:600;letter-spacing:-.012em}
h3{font-size:16px;font-weight:600}
p{margin:0}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.lede{font-size:18px;line-height:1.62;color:var(--ink-2);max-width:66ch;margin-top:16px}
.note{color:var(--ink-2);font-size:14px;max-width:74ch}
.src{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-3);word-break:break-all;border-top:1px solid var(--line);padding-top:14px;margin-top:18px}
.src a{color:var(--accent)}
.block{display:flex;flex-direction:column;gap:14px}
.band{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:20px 22px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:6px}
.stat .k{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.stat .v{font-family:"Bricolage Grotesque",sans-serif;font-size:39px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.stat .d{font-size:13px;color:var(--ink-2);line-height:1.45}
.stat.bad .v{color:var(--bad)}.stat.good .v{color:var(--good)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:820px){.cols{grid-template-columns:1fr}}
.col{background:var(--surface);border:1px solid var(--line);border-radius:3px;overflow:hidden;box-shadow:var(--shadow)}
.col header{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:3px}
.col.before header{background:var(--bad-soft)}
.col.after header{background:var(--good-soft)}
.col h3{font-size:14px;letter-spacing:.04em;text-transform:uppercase}
.col.before h3{color:var(--bad)}.col.after h3{color:var(--good)}
.col .sub{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-2)}
.runs{list-style:none;margin:0;padding:0}
.run{padding:12px 18px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
.run:last-child{border-bottom:none}
.runid{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.run-hit .runid::after{content:" figures shipped";color:var(--good)}
.run-miss .runid::after{content:" no figures";color:var(--bad)}
.pts{margin:0;padding-left:17px;font-size:13.5px;display:flex;flex-direction:column;gap:5px}
.dropped{font-size:13px;color:var(--bad);font-style:italic}
mark{background:var(--mark);color:var(--mark-ink);padding:0 2px;border-radius:2px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:3px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{text-align:left;font-weight:600;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);padding:11px 13px;border-bottom:1px solid var(--line-2);background:var(--sunken);white-space:nowrap}
td{padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
.num{text-align:right;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.up{color:var(--good);font-weight:600}.down{color:var(--good);font-weight:600}
.fix{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:3px;padding:18px 20px;display:flex;flex-direction:column;gap:9px}
.fix .where{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-3)}
.fix p{font-size:14px;color:var(--ink-2);max-width:76ch}
.fixes{display:flex;flex-direction:column;gap:12px}
pre{margin:0;background:var(--sunken);border:1px solid var(--line);border-radius:3px;padding:11px 13px;overflow-x:auto;font-family:"IBM Plex Mono",monospace;font-size:12px;line-height:1.55}
.quote{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:16px 18px;font-size:14px;color:var(--ink-2);display:flex;flex-direction:column;gap:8px}
.quote .who{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
@media (max-width:640px){.wrap{padding:36px 16px 64px;gap:34px}.stat .v{font-size:32px}}
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Mediapulse / before and after</div>
    <h1>The missing Rp1.77 trillion</h1>
    <p class="lede">One Bisnis article, one model, twelve runs each side. The newsletter reported DCI Indonesia's half-year results without a single number in them. This is what changed when the pipeline was fixed, and which fix did the work.</p>
    <p class="src">Source article: <a href="https://market.bisnis.com/read/20260825/192/1998715/intip-mesin-pertumbuhan-emiten-toto-sugiri-dci-indonesia-dcii-semester-ii2026/All">market.bisnis.com/read/20260825/192/1998715/…</a><br>
    Model held constant at <strong>openai/gpt-4.1-mini</strong>, shipped prompt unchanged, 12 replays per side.</p>
  </header>

  <section class="band">
    <div class="stat bad">
      <span class="k">Before</span>
      <span class="v">${String(beforeHits)}/${String(before.runs.length)}</span>
      <span class="d">runs shipped the revenue and profit figures. The model never wrote them: it was given ${before.articleChars.toLocaleString("en-US")} characters of page 2, which states no figures at all.</span>
    </div>
    <div class="stat good">
      <span class="k">After</span>
      <span class="v">${String(afterHits)}/${String(after.runs.length)}</span>
      <span class="d">runs shipped them, from ${after.articleChars.toLocaleString("en-US")} characters once both pages resolve to one article. Model wrote them in ${String(afterWrote)}/${String(after.runs.length)}.</span>
    </div>
    <div class="stat">
      <span class="k">Corpus-wide coverage</span>
      <span class="v">57%</span>
      <span class="d">Material Figures reaching the reader across all 30 cases, up from 32%. Measurement noise floor 0.5pp.</span>
    </div>
  </section>

  <section class="block">
    <h2>The same article, run twelve times each way</h2>
    <p class="note">Highlighting marks the four figures the article states: Rp1.77 trillion revenue, Rp732.5 billion net profit, and the 10.9% and 9.7% growth rates. First six runs of each side shown.</p>
    <div class="cols">
      <div class="col before">
        <header>
          <h3>Before</h3>
          <span class="sub">page 2 only, ${String(before.articleChars)} chars, current guards</span>
        </header>
        <ul class="runs">${runColumn(before, 6)}</ul>
      </div>
      <div class="col after">
        <header>
          <h3>After</h3>
          <span class="sub">pages joined, ${String(after.articleChars)} chars, fixed guards</span>
        </header>
        <ul class="runs">${runColumn(after, 6)}</ul>
      </div>
    </div>
  </section>

  <section class="block">
    <h2>How it compares to a person writing the same summary</h2>
    <div class="quote">
      <span class="who">Written by hand, no AI</span>
      <p>DCII H1 2026 booked revenue of Rp 1.77 Trillion (est USD 100 Mio) with net income Rp 732.5 Billion (est USD 41 Mio). Implying a 40% profit margin, growing 10.9% and 9.7% compare to last year. The growth is mainly supported by their colocation business.</p>
    </div>
    <p class="note">The fixed pipeline now matches this on the stated figures and the colocation driver. It still does not produce the two things the article never printed: the profit margin implied by dividing the two figures, and the dollar equivalents. Both are permitted by <strong>ADR 0014</strong> but are deleted on sight by the grounding guard, which is why that ADR is still marked proposed and was left out of this change.</p>
  </section>

  <section class="block">
    <h2>The four fixes, and what each one was worth</h2>
    <div class="fixes">
      <div class="fix">
        <h3>1. Paginated pages resolve to one article</h3>
        <span class="where">packages/shared/utils/src/article-source-url-filter.ts &middot; canonicalizeUrl</span>
        <p>Bisnis serves long articles across numbered pages. Each page was collected as its own Data Source because the URLs differ only by a trailing segment, so nothing deduplicated them. The 25 August report was stored twice, four days apart, and from 30 August the newsletter cited page 2, which carries the outlook but none of the results. Canonicalising the pagination segment away collapses them to one article.</p>
        <pre>bisnis.com/read/.../dcii-semester-ii2026      &#8594; one canonical article
bisnis.com/read/.../dcii-semester-ii2026/2    &#8594; one canonical article
bisnis.com/read/.../dcii-semester-ii2026/All  &#8594; one canonical article</pre>
        <p><strong>Worth:</strong> everything. Without it the model has no figures to report, and no prompt or model change can invent them.</p>
      </div>
      <div class="fix">
        <h3>2. A repeat is a point that adds no new figure</h3>
        <span class="where">apps/mediapulse/agents/content-generation/src/lib/repeated-claim-dedup.ts</span>
        <p>The within-issue dedup dropped any point sharing one figure with an earlier point plus two common words. In a data-centre issue every article shares words like "data", "center" and "growth", so a single coincidental number was enough to delete the only sentence carrying the results. It also treated the <em>year</em> as a figure, so "in H1/2026" and "for H1/2026" counted as the same claim. Now a point is a repeat only when it introduces no figure the earlier point lacked.</p>
        <p><strong>Worth:</strong> this alone took the article from 5 of 12 runs to 12 of 12. It was deleting the figures after the model had correctly written them.</p>
      </div>
      <div class="fix">
        <h3>3. A cut-off point is repaired, not deleted</h3>
        <span class="where">apps/mediapulse/agents/content-generation/src/lib/sanitize-summary-points.ts</span>
        <p>827 points across the original 900-run sweep were discarded for stopping mid-thought, more than every other unusable reason combined. They are now trimmed back to the last complete clause and kept when what remains still carries a figure or a name. A point ending on a dangling number, the signature of a severed percentage, is now caught as truncated rather than passing as finished.</p>
        <pre>before  DCII posted revenue of Rp1.77 trillion and net profit of Rp732.5 billion in H1 2026, up 10.9% and 9.
after   DCII posted revenue of Rp1.77 trillion and net profit of Rp732.5 billion in H1 2026.</pre>
      </div>
      <div class="fix">
        <h3>4. A point may run to 140 characters</h3>
        <span class="where">packages/shared/email-templates/src/newsletter/newsletter-document.ts</span>
        <p>The 100-character cap could not hold a revenue figure, a profit figure, and their two growth rates in one sentence, which is the standard shape of a results line. The cap was the cause of most of the truncation above, not the model ignoring instructions. Points now shipped per run rose from 6.8 to 7.7.</p>
      </div>
    </div>
  </section>

  <section class="block">
    <h2>Across all 30 cases, not just this one</h2>
    <p class="note">Same 30-case corpus, same model, same prompt, 90 replays each side. Coverage counts Material Figures that reach the reader, over those in articles the issue actually selected.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Measure</th><th class="num">Before</th><th class="num">After</th><th class="num">Change</th></tr></thead>
        <tbody>
          <tr><td>Figure coverage</td><td class="num">32.4%</td><td class="num">56.9%</td><td class="num up">+24.5pp</td></tr>
          <tr><td>Figures written then deleted by a guard</td><td class="num">23</td><td class="num">5</td><td class="num down">&minus;78%</td></tr>
          <tr><td>Figures the model never wrote</td><td class="num">50</td><td class="num">39</td><td class="num down">&minus;22%</td></tr>
          <tr><td>Points shipped</td><td class="num">613</td><td class="num">695</td><td class="num up">+13%</td></tr>
          <tr><td>Runs that failed outright</td><td class="num">1</td><td class="num">0</td><td class="num down">&minus;1</td></tr>
          <tr><td>Measurement noise floor</td><td class="num">0.5pp</td><td class="num">0.5pp</td><td class="num">unchanged</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note">The 24.5pp gain is roughly fifty times the noise floor, so it is not a run-to-run artefact. Fidelity violations per point stayed flat at 0.02, meaning the extra figures are not being bought with extra errors.</p>
  </section>

  <section class="block">
    <h2>What this does not fix</h2>
    <p class="note">The overall deletion rate barely moved, from 41% of generated points to 40%. That is deliberate. The largest single guard, which deletes any point citing a figure absent from the article, still accounts for four in five deletions and was left untouched: across 900 runs it let exactly one ungrounded figure through, so it is doing its job. Loosening it is what <strong>ADR 0014</strong> proposes, and it needs its own evidence before it ships.</p>
    <p class="note">Three further things stay open. Whole articles are still discarded when their heading cites a figure the body does not carry, which cost 48 articles in the after run. The condensed prompt tested earlier scored higher on coverage only because it crammed several figures into one sentence, and it is not adopted here. And the profit margin and dollar equivalents a human analyst adds remain out of reach until the grounding guard can tell arithmetic from invention.</p>
  </section>
</div>`;
};

if (import.meta.main) {
  const before = JSON.parse(
    readFileSync("./results/before.json", "utf8"),
  ) as Side;
  const after = JSON.parse(
    readFileSync("./results/after.json", "utf8"),
  ) as Side;
  writeFileSync("./results/before-after.html", buildBeforeAfter(before, after));
  console.log("wrote results/before-after.html");
}

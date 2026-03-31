import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  buildAiReviewPrompt,
  filterAiReviewMarkdownFindings,
  selectSkillRelativePaths,
  truncateMiddle,
} from "./lib/ai-pr-review.mjs";

const MARKER = "<!-- cursor-ai-review -->";

/**
 * @param {string} repoRoot
 * @param {string} relPath
 * @returns {Promise<string | null>}
 */
const tryReadUtf8 = async (repoRoot, relPath) => {
  try {
    return await readFile(path.join(repoRoot, relPath), "utf8");
  } catch {
    return null;
  }
};

/**
 * @param {string} repoRoot
 * @returns {Promise<readonly { relPath: string; content: string }[]>}
 */
const loadAllRuleChunks = async (repoRoot) => {
  const rulesDir = path.join(repoRoot, ".cursor", "rules");
  const ents = await readdir(rulesDir, { withFileTypes: true });
  const relPaths = ents
    .filter((e) => e.isFile() && e.name.endsWith(".mdc"))
    .map((e) => path.join(".cursor", "rules", e.name).replaceAll("\\", "/"))
    .sort((a, b) => a.localeCompare(b));

  /** @type {{ relPath: string; content: string }[]} */
  const out = [];
  for (const rel of relPaths) {
    const content = await tryReadUtf8(repoRoot, rel);
    if (content !== null) out.push({ relPath: rel, content });
  }
  return out;
};

/**
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} issueNumber
 * @returns {Promise<{ id: number; url: string } | null>}
 */
const findExistingReviewComment = async (token, owner, repo, issueNumber) => {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return null;
  /** @type {readonly { id: number; url: string; body?: string }[]} */
  const data = await res.json();
  const found = data.find((c) => c.body?.includes(MARKER) === true);
  return found ? { id: found.id, url: found.url } : null;
};

/**
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} issueNumber
 * @param {string} body
 * @returns {Promise<void>}
 */
const upsertReviewComment = async (token, owner, repo, issueNumber, body) => {
  const existing = await findExistingReviewComment(
    token,
    owner,
    repo,
    issueNumber,
  );

  if (existing) {
    const res = await fetch(existing.url, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      console.error(await res.text());
      process.exitCode = 1;
    }
    return;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) {
    console.error(await res.text());
    process.exitCode = 1;
  }
};

const main = async () => {
  const repoRoot = process.cwd();
  const baseSha = process.env.CURSOR_REVIEW_BASE_SHA ?? "";
  const headSha = process.env.CURSOR_REVIEW_HEAD_SHA ?? "";

  if (baseSha.length === 0 || headSha.length === 0) {
    console.log(
      "ai-pr-review: CURSOR_REVIEW_BASE_SHA and CURSOR_REVIEW_HEAD_SHA are required.",
    );
    process.exitCode = 1;
    return;
  }

  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only", `${baseSha}...${headSha}`],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let diffText = execFileSync("git", ["diff", `${baseSha}...${headSha}`], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  const maxRawDiff = Number(process.env.AI_REVIEW_MAX_RAW_DIFF ?? "400000");
  if (diffText.length > maxRawDiff) {
    diffText =
      `# Diff too large for full inline review (${String(diffText.length)} chars). Showing changed paths and a truncated excerpt.\n\n` +
      `## Changed files\n\n${changedFiles.map((f) => `- ${f}`).join("\n")}\n\n` +
      `## Truncated diff excerpt\n\n` +
      truncateMiddle(diffText, Math.floor(maxRawDiff / 4));
  }

  const ruleChunks = await loadAllRuleChunks(repoRoot);
  const skillRelPaths = selectSkillRelativePaths(changedFiles);

  /** @type {{ relPath: string; content: string }[]} */
  const skillChunks = [];
  for (const rel of skillRelPaths) {
    const content = await tryReadUtf8(repoRoot, rel);
    if (content !== null) skillChunks.push({ relPath: rel, content });
  }

  const maxDiffChars = Number(process.env.AI_REVIEW_MAX_DIFF_CHARS ?? "120000");
  const maxContextChars = Number(
    process.env.AI_REVIEW_MAX_CONTEXT_CHARS ?? "120000",
  );
  const rawSkillReserve = Number(
    process.env.AI_REVIEW_SKILL_RESERVE_RATIO ?? "",
  );

  const prompt = buildAiReviewPrompt({
    diffText,
    maxDiffChars,
    maxContextChars,
    skillContextReserveRatio: Number.isFinite(rawSkillReserve)
      ? rawSkillReserve
      : undefined,
    ruleChunks,
    skillChunks,
  });

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.log("ai-pr-review: OPENAI_API_KEY not set; skipping.");
    return;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const completionRes = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              'You are an automated PR reviewer for this monorepo. Check the diff against the pasted rules and skills honestly. Keep output minimal, but do not be overly conservative: if there is any reasonably supported rules/skills violation in apps/ or packages/ code, include a Finding row. Every Finding must anchor to a concrete repo-relative file path from the diff (never "—" for File), and never target repo-root scripts/ paths. Do not emit vague workflow-only compliance rows (for example "did not read rules first" / "did not run code-quality") unless tied to a specific product-file diff violation. Never invent findings or generic follow-up advice. Prefer should-fix over nice-to-have when a real process gap exists. Use the Findings table with exactly the five columns from the user prompt when and only when you have at least one such row; do not add or rename columns.',
          },
          { role: "user", content: prompt },
        ],
      }),
    },
  );

  if (!completionRes.ok) {
    console.error(await completionRes.text());
    process.exitCode = 1;
    return;
  }

  /** @type {{ choices?: ReadonlyArray<{ message?: { content?: string } }> }} */
  const completionJson = await completionRes.json();
  const reviewMd = filterAiReviewMarkdownFindings(
    completionJson.choices?.[0]?.message?.content ?? "",
  );

  const body = `${MARKER}\n## Cursor AI Review\n\n${reviewMd}`;

  const token = process.env.GITHUB_TOKEN ?? "";
  const repoFull = process.env.GITHUB_REPOSITORY ?? "";
  const prNumber = process.env.PR_NUMBER ?? "";

  if (token.length === 0 || repoFull.length === 0 || prNumber.length === 0) {
    console.log(
      "ai-pr-review: GITHUB_TOKEN / GITHUB_REPOSITORY / PR_NUMBER missing; printed review to stdout only.",
    );
    // eslint-disable-next-line no-console
    console.log(reviewMd);
    return;
  }

  const [owner, repo] = repoFull.split("/");
  if (owner.length === 0 || repo.length === 0) {
    console.log(
      "ai-pr-review: invalid GITHUB_REPOSITORY; printing review only.",
    );
    // eslint-disable-next-line no-console
    console.log(reviewMd);
    return;
  }

  await upsertReviewComment(token, owner, repo, prNumber, body);
};

await main();

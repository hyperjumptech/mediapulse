export const TARGET_DOMAINS = [
  "investortrust.id",
  "infobanknews.com",
  "swa.co.id",
  "kemenpar.go.id",
  "ojk.go.id",
  "tvrinews.com",
  "timesindonesia.co.id",
  "pom.go.id",
];

export const SERPER_OUTAGE = {
  start: "2026-10-30 17:48:00",
  end: "2026-11-05 17:03:00",
};

export const VARIANTS = [
  "baseline",
  "markdown",
  "markdown-text",
  "canonical",
  "amp",
];

export const CONTENT_MATCH_THRESHOLD = 0.3;
const TITLE_LINE_MATCH = 0.7;

export const FEED_CANDIDATES = [
  "https://money.kompas.com/sitemap-news-money.xml",
  "https://nasional.kompas.com/sitemap-news-nasional.xml",
  "https://tekno.kompas.com/sitemap-news-tekno.xml",
  "https://www.idntimes.com/business/sitemap-news.xml",
  "https://www.idntimes.com/news/sitemap-news.xml",
];

const DAY_MS = 24 * 60 * 60 * 1000;

export const feedStats = (items, { now, isExcluded }) => {
  const fresh = items.filter((item) => {
    const published = Date.parse(item.publishedAt ?? "");

    return Number.isFinite(published) && now - published <= DAY_MS;
  }).length;
  const direct = items.filter((item) => !isExcluded(item.url)).length;

  return { items: items.length, fresh, direct };
};

export const newestFirst = (items) =>
  [...items].sort(
    (a, b) =>
      (Date.parse(b.publishedAt ?? "") || 0) -
      (Date.parse(a.publishedAt ?? "") || 0),
  );

export const MIN_URLS_FOR_DECISION = 8;
export const ADOPT_RATE = 0.7;
export const MATCH_THRESHOLD = 0.5;
export const SHORT_BY_NATURE_SHARE = 0.5;

export const canonicalForm = (rawUrl) => {
  const url = new URL(rawUrl);
  url.search = "";
  url.hash = "";

  return url.toString();
};

const isAmpUrl = (rawUrl) => {
  const url = new URL(rawUrl);

  return (
    url.hostname.startsWith("amp.") ||
    /(^|\/)amp(\/|$)/.test(url.pathname) ||
    url.searchParams.has("amp")
  );
};

export const ampCandidates = (rawUrl) => {
  if (isAmpUrl(rawUrl)) {
    return [];
  }
  const base = new URL(canonicalForm(rawUrl));
  const suffixed = new URL(base);
  suffixed.pathname = `${base.pathname.replace(/\/+$/, "")}/amp`;
  const subdomain = new URL(base);
  subdomain.hostname = `amp.${base.hostname.replace(/^www\./, "")}`;

  return [...new Set([suffixed.toString(), subdomain.toString()])];
};

export const variantUrls = (variant, rawUrl) => {
  if (
    variant === "baseline" ||
    variant === "retry" ||
    variant === "markdown" ||
    variant === "markdown-text"
  ) {
    return [rawUrl];
  }
  if (variant === "canonical") {
    const canonical = canonicalForm(rawUrl);

    return canonical === rawUrl ? [] : [canonical];
  }
  if (variant === "amp") {
    return ampCandidates(rawUrl);
  }

  throw new Error(`Unknown variant: ${variant}`);
};

const tokensOf = (text) => text.toLowerCase().match(/\p{L}{4,}/gu) ?? [];

export const articleMatch = (title, body) => {
  const titleTokens = [...new Set(tokensOf(title ?? ""))];
  if (titleTokens.length === 0) {
    return 0;
  }
  const bodyTokens = new Set(tokensOf(body ?? ""));
  const found = titleTokens.filter((token) => bodyTokens.has(token)).length;

  return found / titleTokens.length;
};

export const contentMatch = (title, body) => {
  const content = (body ?? "")
    .split("\n")
    .filter((line) => articleMatch(line, title ?? "") < TITLE_LINE_MATCH)
    .join("\n");

  return articleMatch(title, content);
};

export const markdownToText = (markdown) =>
  (markdown ?? "")
    .replace(/^---\n[\s\S]*?\n---\n/m, "")
    .split("\n")
    .filter((line) => !/^\s*meta-[\w:-]+\s*:/i.test(line))
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_`>|]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const wordCount = (body) =>
  (body ?? "").split(/\s+/).filter(Boolean).length;

export const isUsable = (cell) =>
  cell.fetched && !cell.gateBlocked && cell.matchRatio >= MATCH_THRESHOLD;

export const cellKey = (variant, url) => `${variant}|${url}`;

export const pickCorpus = (rows, { domains, failing, controls }) => {
  const byDomain = new Map(domains.map((domain) => [domain, []]));
  for (const row of rows) {
    byDomain.get(row.domain)?.push(row);
  }

  return domains.flatMap((domain) => {
    const domainRows = [...(byDomain.get(domain) ?? [])].sort((a, b) =>
      String(b.fetchedAt).localeCompare(String(a.fetchedAt)),
    );
    const failingRows = domainRows
      .filter((row) => row.status !== "succeeded")
      .slice(0, failing)
      .map((row) => ({ ...row, kind: "failing" }));
    const controlRows = domainRows
      .filter((row) => row.status === "succeeded")
      .slice(0, controls)
      .map((row) => ({ ...row, kind: "control" }));

    return [...failingRows, ...controlRows];
  });
};

const increment = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

export const summarize = (cells) => {
  const groups = new Map();
  for (const cell of cells) {
    const key = `${cell.domain}|${cell.variant}|${cell.kind}`;
    const group = groups.get(key) ?? {
      domain: cell.domain,
      variant: cell.variant,
      kind: cell.kind,
      tested: 0,
      usable: 0,
      fetched: 0,
      shortButMatched: 0,
      gateReasons: {},
      errors: {},
    };
    group.tested += 1;
    if (cell.usable) {
      group.usable += 1;
    }
    if (cell.fetched) {
      group.fetched += 1;
    } else {
      increment(group.errors, cell.errorCategory ?? "unknown");
    }
    if (cell.gateBlocked) {
      increment(group.gateReasons, cell.gateReason ?? "unknown");
      if (
        cell.gateReason === "content_too_short" &&
        (cell.contentMatchRatio ?? 0) >= CONTENT_MATCH_THRESHOLD
      ) {
        group.shortButMatched += 1;
      }
    }
    groups.set(key, group);
  }

  return [...groups.values()];
};

const rateOf = (group) =>
  group && group.tested > 0 ? group.usable / group.tested : null;

export const decideDomain = (domain, groups) => {
  const failing = groups.filter(
    (group) => group.domain === domain && group.kind === "failing",
  );
  const controls = groups.filter(
    (group) => group.domain === domain && group.kind === "control",
  );
  const baseline = failing.find((group) => group.variant === "baseline");
  if (!baseline || baseline.tested < MIN_URLS_FOR_DECISION) {
    return { decision: "too_few_urls", variant: null };
  }
  const controlBaseline = rateOf(
    controls.find((group) => group.variant === "baseline"),
  );
  const keepsControls = (group) => {
    const controlRate = rateOf(
      controls.find((control) => control.variant === group.variant),
    );

    return (
      controlBaseline === null ||
      controlRate === null ||
      controlRate >= controlBaseline
    );
  };
  const winner = failing
    .filter(
      (group) =>
        group.tested >= MIN_URLS_FOR_DECISION &&
        rateOf(group) >= ADOPT_RATE &&
        keepsControls(group),
    )
    .sort(
      (a, b) =>
        rateOf(b) - rateOf(a) ||
        Number(b.variant === "baseline") - Number(a.variant === "baseline"),
    )[0];
  if (winner) {
    return {
      decision: winner.variant === "baseline" ? "recovered" : "adopt",
      variant: winner.variant,
    };
  }
  if (baseline.shortButMatched / baseline.tested >= SHORT_BY_NATURE_SHARE) {
    return { decision: "short_by_nature", variant: null };
  }

  return { decision: "no_serper_fix", variant: null };
};

const topKey = (counts) =>
  Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

const ratio = (group) =>
  group ? `${String(group.usable)}/${String(group.tested)}` : "";

export const renderReport = (groups, domains) => {
  const header = `| Domain | Decision | ${VARIANTS.join(" | ")} | Controls (baseline) | Top gate reason | Top fetch error |`;
  const divider = `|${" --- |".repeat(VARIANTS.length + 5)}`;
  const rows = domains
    .filter((domain) => groups.some((group) => group.domain === domain))
    .map((domain) => {
      const find = (variant, kind) =>
        groups.find(
          (group) =>
            group.domain === domain &&
            group.variant === variant &&
            group.kind === kind,
        );
      const { decision, variant } = decideDomain(domain, groups);
      const baseline = find("baseline", "failing");
      const label = variant ? `${decision} (${variant})` : decision;

      return `| ${domain} | ${label} | ${VARIANTS.map((name) => ratio(find(name, "failing"))).join(" | ")} | ${ratio(find("baseline", "control"))} | ${topKey(baseline?.gateReasons ?? {})} | ${topKey(baseline?.errors ?? {})} |`;
    });

  return [
    "Usable bodies on URLs that failed in production (usable / tested).",
    "",
    header,
    divider,
    ...rows,
  ].join("\n");
};

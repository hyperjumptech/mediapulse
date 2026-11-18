const MP = "https://mediapulse.hyperjump.tech/ontology#";
const ORG = "http://www.w3.org/ns/org#";

export const SKIPPED_CLASSES = new Set([
  "ArticlePoint",
  "Measurement",
  "DataSource",
]);

const ORGANIZATION_CLASSES = new Set([
  "Company",
  "ListedCompany",
  "Organization",
  "GovernmentBody",
  "Regulator",
]);
const PUBLIC_BODY_CLASSES = new Set([
  "GovernmentBody",
  "Regulator",
  "Organization",
]);
const SMALL_CLASS_LIMIT = 100;
const LEGAL_WORDS = new Set([
  "pt",
  "tbk",
  "persero",
  "cv",
  "inc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "plc",
  "llc",
  "pte",
  "sdn",
  "bhd",
  "gmbh",
]);
const ACRONYM_SKIPPED_WORDS = new Set([
  ...LEGAL_WORDS,
  "dan",
  "and",
  "of",
  "the",
  "untuk",
  "di",
  "republik",
]);
const REGULATION_SHORT_FORMS = [
  [/\bundang undang\b/g, "uu"],
  [/\bperaturan pemerintah\b/g, "pp"],
  [/\bperaturan presiden\b/g, "perpres"],
  [/\bperaturan menteri\b/g, "permen"],
  [/\bperaturan otoritas jasa keuangan\b/g, "pojk"],
  [/\bperaturan bank indonesia\b/g, "pbi"],
];
const REGULATION_FILLER_WORDS = new Set(["nomor", "no", "tahun", "thn", "th"]);
const DATED_LABEL = /,\s*(\d{4})(?:-\d{2})?(?:-\d{2})?\s*$/;

export const localName = (iri) => iri.split(/[#/]/).pop() ?? iri;

export const looseName = (text) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const coreName = (text) =>
  looseName(text)
    .split(" ")
    .filter((word) => word !== "" && !LEGAL_WORDS.has(word))
    .join(" ");

export const acronymOf = (label) => {
  const words = looseName(label)
    .split(" ")
    .filter((word) => word !== "" && !ACRONYM_SKIPPED_WORDS.has(word));

  return words.length >= 2 ? words.map((word) => word[0]).join("") : null;
};

export const regulationKey = (label) => {
  let text = looseName(label);
  for (const [pattern, shortForm] of REGULATION_SHORT_FORMS) {
    text = text.replace(pattern, shortForm);
  }
  const words = text
    .split(" ")
    .filter((word) => word !== "" && !REGULATION_FILLER_WORDS.has(word));

  return words.some((word) => /^\d+$/.test(word)) ? words.join(" ") : null;
};

const value = (binding, key) => binding[key]?.value;

export const collectInstances = ({ labelRows, nameRows }) => {
  const instances = new Map();
  for (const row of labelRows) {
    const className = localName(value(row, "class"));
    if (SKIPPED_CLASSES.has(className)) {
      continue;
    }
    const iri = value(row, "s");
    const instance = instances.get(iri) ?? {
      iri,
      label: value(row, "label"),
      classes: [],
      names: [],
      ticker: null,
    };
    if (!instance.classes.includes(className)) {
      instance.classes.push(className);
    }
    instances.set(iri, instance);
  }
  for (const row of nameRows) {
    const instance = instances.get(value(row, "s"));
    if (!instance) {
      continue;
    }
    const property = localName(value(row, "p"));
    if (property === "ticker") {
      instance.ticker = value(row, "name");
    } else {
      instance.names.push(value(row, "name"));
    }
  }

  return instances;
};

const familyOf = (instance) => {
  if (
    instance.classes.some((className) => ORGANIZATION_CLASSES.has(className))
  ) {
    return "organization";
  }

  return [...instance.classes].sort()[0];
};

const isListed = (instance) => instance.classes.includes("ListedCompany");

const isPublicBody = (instance) =>
  instance.classes.some((className) => PUBLIC_BODY_CLASSES.has(className));

const createClusters = (sameAsPairs) => {
  const parent = new Map();
  const find = (iri) => {
    let root = iri;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root);
    }
    parent.set(iri, root);

    return root;
  };
  for (const [a, b] of sameAsPairs) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  return find;
};

const pairKey = (a, b) => (a < b ? `${a} ${b}` : `${b} ${a}`);

export const findDuplicateCandidates = ({
  instances,
  sameAsPairs = [],
  differentFromPairs = [],
  memberships = [],
}) => {
  const clusterOf = createClusters(sameAsPairs);
  const different = new Set(differentFromPairs.map(([a, b]) => pairKey(a, b)));
  const candidates = new Map();
  const add = (a, b, rule, detail) => {
    if (a.iri === b.iri || clusterOf(a.iri) === clusterOf(b.iri)) {
      return;
    }
    if (different.has(pairKey(a.iri, b.iri))) {
      return;
    }
    if (isListed(a) && isListed(b)) {
      return;
    }
    if (familyOf(a) !== familyOf(b)) {
      return;
    }
    const key = pairKey(a.iri, b.iri);
    const [first, second] = a.iri < b.iri ? [a, b] : [b, a];
    const entry = candidates.get(key) ?? { a: first, b: second, reasons: [] };
    const reason = `${rule}: ${detail}`;
    if (!entry.reasons.includes(reason)) {
      entry.reasons.push(reason);
    }
    candidates.set(key, entry);
  };

  const byName = new Map();
  for (const instance of instances.values()) {
    const labelName = coreName(instance.label);
    for (const name of new Set(
      [instance.label, ...instance.names].map(coreName),
    )) {
      if (name === "") {
        continue;
      }
      const entries = byName.get(name) ?? [];
      entries.push({ instance, isLabel: name === labelName });
      byName.set(name, entries);
    }
  }
  for (const [name, entries] of byName) {
    const isShortAcronym = !name.includes(" ") && name.length <= 5;
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [first, second] = [entries[i], entries[j]];
        if (isShortAcronym && !first.isLabel && !second.isLabel) {
          continue;
        }
        add(first.instance, second.instance, "same name", name);
      }
    }
  }

  const byLabel = new Map();
  for (const instance of instances.values()) {
    const label = coreName(instance.label);
    byLabel.set(label, [...(byLabel.get(label) ?? []), instance]);
  }
  for (const instance of instances.values()) {
    const acronym = acronymOf(instance.label);
    if (!acronym) {
      continue;
    }
    const ownNames = new Set(instance.names.map(coreName));
    for (const other of byLabel.get(acronym) ?? []) {
      if (
        (isPublicBody(instance) && isPublicBody(other)) ||
        ownNames.has(acronym)
      ) {
        add(instance, other, "acronym", acronym.toUpperCase());
      }
    }
  }

  const byRegulation = new Map();
  for (const instance of instances.values()) {
    if (!instance.classes.includes("Regulation")) {
      continue;
    }
    const key = regulationKey(instance.label);
    if (key) {
      byRegulation.set(key, [...(byRegulation.get(key) ?? []), instance]);
    }
  }
  for (const [key, group] of byRegulation) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        add(group[i], group[j], "same regulation", key);
      }
    }
  }

  const people = [...instances.values()].filter((instance) =>
    instance.classes.includes("Person"),
  );
  const wordsOf = (instance) => new Set(looseName(instance.label).split(" "));
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const [shorter, longer] = [wordsOf(people[i]), wordsOf(people[j])].sort(
        (x, y) => x.size - y.size,
      );
      const shared = [...shorter].filter((word) => longer.has(word));
      if (shared.length >= 2 && shared.length === shorter.size) {
        add(people[i], people[j], "name inside name", shared.join(" "));
      }
    }
  }

  const byMember = new Map();
  for (const membership of memberships) {
    const instance = instances.get(membership.iri);
    if (!instance) {
      continue;
    }
    const key = `${clusterOf(membership.member)} ${clusterOf(membership.organization)}`;
    byMember.set(key, [...(byMember.get(key) ?? []), instance]);
  }
  for (const group of byMember.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        add(group[i], group[j], "same person and organization", group[i].label);
      }
    }
  }

  return [...candidates.values()];
};

export const findEventGroups = ({ instances, sameAsPairs = [] }) => {
  const clusterOf = createClusters(sameAsPairs);
  const parties = [...instances.values()]
    .filter(
      (instance) =>
        familyOf(instance) === "organization" ||
        instance.classes.includes("Person"),
    )
    .map((instance) => instance.label)
    .filter((label) => label.length >= 2)
    .sort((a, b) => b.length - a.length);
  const groups = new Map();
  for (const instance of instances.values()) {
    if (
      !instance.classes.some(
        (className) => className === "Event" || className === "CorporateAction",
      )
    ) {
      continue;
    }
    const year = DATED_LABEL.exec(instance.label)?.[1];
    const party = parties.find((label) =>
      instance.label.startsWith(`${label} `),
    );
    if (!year || !party) {
      continue;
    }
    const key = `${party}, ${year}`;
    groups.set(key, [...(groups.get(key) ?? []), instance]);
  }

  return [...groups]
    .map(([key, group]) => {
      const byCluster = new Map();
      for (const instance of group) {
        const cluster = clusterOf(instance.iri);
        byCluster.set(
          cluster,
          [...(byCluster.get(cluster) ?? []), instance.label].sort(),
        );
      }
      const labels = [...byCluster.values()]
        .map(([first, ...linked]) =>
          linked.length > 0 ? `${first} (+${linked.length} linked)` : first,
        )
        .sort();

      return { key, labels };
    })
    .filter((group) => group.labels.length > 1);
};

export const smallClasses = (instances) => {
  const byClass = new Map();
  for (const instance of instances.values()) {
    for (const className of instance.classes) {
      byClass.set(className, [...(byClass.get(className) ?? []), instance]);
    }
  }

  return [...byClass]
    .filter(([, group]) => group.length <= SMALL_CLASS_LIMIT)
    .map(([className, group]) => ({
      className,
      labels: group
        .map((instance) =>
          instance.names.length > 0
            ? `${instance.label} (${instance.names.join("; ")})`
            : instance.label,
        )
        .sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));
};

const describe = (instance) =>
  `${instance.label} [${instance.classes.join(", ")}${instance.ticker ? ` ${instance.ticker}` : ""}]`;

const escapeCell = (text) => text.replaceAll("|", "\\|");

export const formatReport = ({ candidates, eventGroups, classes, date }) => {
  const lines = [`# Knowledge graph duplicate candidates, ${date}`, ""];
  lines.push(
    `${candidates.length} candidate pairs, ${eventGroups.length} groups of events or deals to compare.`,
    "",
    "## Candidate pairs",
    "",
    "| # | First | Second | Why |",
    "| --- | --- | --- | --- |",
  );
  candidates.forEach((candidate, index) => {
    lines.push(
      `| ${index + 1} | ${escapeCell(describe(candidate.a))} | ${escapeCell(describe(candidate.b))} | ${escapeCell(candidate.reasons.join("; "))} |`,
    );
  });
  lines.push("", "## Events and deals of one party in one year", "");
  for (const group of eventGroups) {
    lines.push(
      `- **${group.key}**`,
      ...group.labels.map((label) => `  - ${label}`),
    );
  }
  lines.push("", "## Small classes to read through", "");
  for (const group of classes) {
    lines.push(
      `- **${group.className}** (${group.labels.length}): ${group.labels.join(" | ")}`,
    );
  }

  return `${lines.join("\n")}\n`;
};

export const QUERIES = {
  labels: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX mp: <${MP}>
PREFIX org: <${ORG}>
SELECT ?s ?class ?label WHERE {
  ?s a ?class ; rdfs:label ?label .
  FILTER(STRSTARTS(STR(?class), STR(mp:)) || ?class = org:Membership)
} ORDER BY ?s ?class`,
  names: `PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX mp: <${MP}>
SELECT ?s ?p ?name WHERE {
  VALUES ?p { dcterms:alternative skos:altLabel mp:legalName mp:ticker }
  ?s ?p ?name .
} ORDER BY ?s ?p ?name`,
  links: `PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?a ?relation ?b WHERE {
  VALUES ?relation { owl:sameAs owl:differentFrom }
  ?a ?relation ?b .
} ORDER BY ?a ?b`,
  memberships: `PREFIX org: <${ORG}>
SELECT ?m ?member ?organization WHERE {
  ?m a org:Membership ; org:member ?member ; org:organization ?organization .
} ORDER BY ?m`,
};

export const fetchAllPages = async (runSparql, query, pageSize = 1000) => {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await runSparql(
      `${query}\nLIMIT ${pageSize} OFFSET ${offset}`,
    );
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
};

export const loadGraph = async (runSparql) => {
  const [labelRows, nameRows, linkRows, membershipRows] = await Promise.all([
    fetchAllPages(runSparql, QUERIES.labels),
    fetchAllPages(runSparql, QUERIES.names),
    fetchAllPages(runSparql, QUERIES.links),
    fetchAllPages(runSparql, QUERIES.memberships),
  ]);
  const pairsFor = (relation) =>
    linkRows
      .filter((row) => localName(value(row, "relation")) === relation)
      .map((row) => [value(row, "a"), value(row, "b")]);

  return {
    instances: collectInstances({ labelRows, nameRows }),
    sameAsPairs: pairsFor("sameAs"),
    differentFromPairs: pairsFor("differentFrom"),
    memberships: membershipRows.map((row) => ({
      iri: value(row, "m"),
      member: value(row, "member"),
      organization: value(row, "organization"),
    })),
  };
};

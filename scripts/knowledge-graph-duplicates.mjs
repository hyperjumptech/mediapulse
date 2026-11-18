import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { createOrganonSparqlClient } from "../packages/mediapulse/knowledge-graph/src/organon-sparql-client.js";
import {
  findDuplicateCandidates,
  findEventGroups,
  formatReport,
  loadGraph,
  smallClasses,
} from "./lib/knowledge-graph-duplicates.mjs";

const SPARQL_TIMEOUT_MS = 60_000;

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    json: { type: "string" },
  },
});

const baseUrl = process.env.ORGANON_API_URL;
const apiKey = process.env.ORGANON_API_KEY;
if (!baseUrl || !apiKey) {
  console.error(
    "Set ORGANON_API_URL and ORGANON_API_KEY to the knowledge graph you want to audit. A read key is enough.",
  );
  process.exit(1);
}

const runSparql = createOrganonSparqlClient({
  baseUrl,
  apiKey,
  timeoutMs: SPARQL_TIMEOUT_MS,
  includeInferred: false,
});
const graph = await loadGraph(runSparql);
const candidates = findDuplicateCandidates(graph);
const eventGroups = findEventGroups(graph);
const report = formatReport({
  candidates,
  eventGroups,
  classes: smallClasses(graph.instances),
  date: new Date().toISOString().slice(0, 10),
});

if (values.json) {
  writeFileSync(
    values.json,
    `${JSON.stringify(
      candidates.map(({ a, b, reasons }) => ({
        first: { iri: a.iri, label: a.label, classes: a.classes },
        second: { iri: b.iri, label: b.label, classes: b.classes },
        reasons,
      })),
      null,
      2,
    )}\n`,
  );
}
if (values.out) {
  writeFileSync(values.out, report);
  console.log(
    `${graph.instances.size} instances read, ${candidates.length} candidate pairs, ${eventGroups.length} event groups. Report: ${values.out}`,
  );
} else {
  process.stdout.write(report);
}

# @mediapulse/knowledge-graph

Reads the MediaPulse knowledge graph over SPARQL and keeps the `ticker` table in step with the listed companies it holds.

## Usage

```ts
import {
  createOrganonSparqlClient,
  loadListedCompanies,
  syncTickersFromKnowledgeGraph,
} from "@mediapulse/knowledge-graph";
import { prisma } from "@mediapulse/database";

const runSparql = createOrganonSparqlClient({
  baseUrl: "https://organon.hyperjump.tech",
  apiKey: "<read key>",
  timeoutMs: 40_000,
});
const companies = await loadListedCompanies(runSparql);
const result = await syncTickersFromKnowledgeGraph(companies, prisma);
```

## API

| Export                                         | Description                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createOrganonSparqlClient(options)`           | Returns a function that posts a SPARQL `SELECT` to the knowledge graph and resolves to its bindings.                                                           |
| `loadListedCompanies(runSparql)`               | Returns one `{ symbol, name }` per listed company, sorted by symbol. The name is the legal name, or the label when there is none. Throws when none comes back. |
| `syncTickersFromKnowledgeGraph(companies, db)` | Adds missing symbols and updates names that differ. It never deletes. Returns `{ added, updated, unchanged, missingFromKnowledgeGraph }`.                      |

`missingFromKnowledgeGraph` lists, sorted, the symbols in the table that the knowledge graph does not list.

## Scripts

- `pnpm test` runs the unit tests
- `pnpm test:coverage` runs them with coverage
- `pnpm type:check` checks types
- `pnpm lint` runs ESLint

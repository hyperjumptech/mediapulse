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

| Export                                         | Description                                                                                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createOrganonSparqlClient(options)`           | Returns a function that posts a SPARQL `SELECT` to the knowledge graph and resolves to its bindings.                                                                                                  |
| `loadListedCompanies(runSparql)`               | Returns one `{ symbol, name }` per listed company, sorted by symbol. The name is the legal name, or the label when there is none. Throws when none comes back.                                        |
| `syncTickersFromKnowledgeGraph(companies, db)` | Adds missing symbols and removes unlisted tickers nothing references. Never renames a ticker, and refuses to remove more than 25 at once. Returns `{ added, alreadyPresent, removed, keptUnlisted }`. |

`removed` lists the tickers deleted because the knowledge graph no longer lists them. `keptUnlisted` lists the unlisted tickers kept because subscribers, newsletters or run history still reference them.

## Scripts

- `pnpm test` runs the unit tests
- `pnpm test:coverage` runs them with coverage
- `pnpm type:check` checks types
- `pnpm lint` runs ESLint

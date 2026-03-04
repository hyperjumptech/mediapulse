# @workspace/idx-tickers-importer

Imports IDX (Indonesian Stock Exchange) listed companies data into the MediaPulse database. Accepts the JSON payload from the IDX API (e.g. listed companies table), maps each row to a `Ticker` record, and upserts by symbol (`KodeEmiten`).

The example payload is available in `idx.example.json`. The real payload can be obtained from https://www.idx.co.id/Primary/ListedCompany/GetCompanyProfiles?emitenType=&start=0&length=9999.

## Prerequisites

- `@workspace/database` with the `ticker` table and optional `metadata` column (run migrations so the ticker metadata migration is applied).

## Installation

Use as a workspace dependency:

```json
{
  "dependencies": {
    "@workspace/idx-tickers-importer": "workspace:*"
  }
}
```

## Usage

```ts
import { importIdxTickers } from "@workspace/idx-tickers-importer";

// payload: IDX API response with { data: IdxEmitenRow[] }
const payload = await response.json();
const { processed } = await importIdxTickers(payload);
console.log(`Processed ${processed} tickers`);
```

With a custom database client (e.g. for tests):

```ts
import { importIdxTickers } from "@workspace/idx-tickers-importer";

const db = getPrismaClient(); // or a mock
const { processed } = await importIdxTickers(payload, db);
```

## API

| Export                           | Description                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `importIdxTickers(payload, db?)` | Upserts each `payload.data` row into `ticker` by symbol. Returns `{ processed: number }`.                           |
| `mapIdxRowToTicker(row)`         | Maps one IDX row to `{ symbol, name, metadata }` (symbol = `KodeEmiten`, name = `NamaEmiten`, metadata = full row). |
| `IdxTickersPayload`              | Type for the IDX API response: `{ draw?, recordsTotal?, recordsFiltered?, data: IdxEmitenRow[] }`.                  |
| `IdxEmitenRow`                   | Type for one listed company row (KodeEmiten, NamaEmiten, Sektor, etc.).                                             |
| `TickerUpsertDb`                 | Minimal DB type for dependency injection (requires `ticker.upsert`).                                                |

Rows with empty `KodeEmiten` are skipped. Existing tickers are updated by symbol; new symbols are inserted. The full IDX row is stored in `ticker.metadata`.

## Scripts

- `pnpm test` — run unit tests
- `pnpm test:coverage` — run tests with coverage
- `pnpm run type:check` — TypeScript check
- `pnpm run lint` — ESLint

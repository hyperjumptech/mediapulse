# `env`

If you update the `.env.example` file, you need to run `npm run build` from the directory of this package to generate the type-safe environment variables object.

## Usage

```ts
import { env } from "@workspace/env";

const dbUrl = env.DB_URL;
const fetchTimeoutMs = env.NEXT_PUBLIC_FETCH_TIMEOUT_MS;
```

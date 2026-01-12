# `eslint-plugin-strict-env`

## Rules

### `no-process-env`

Disallows direct access to `process.env` and suggests using a safe import path instead.

#### Options

```javascript
{
  "strict-env/no-process-env": ["error", {
    "envPath": "@workspace/env" // default
  }]
}
```

- `envPath` (string, default: `"@workspace/env"`): The import path to use for the `env` import.

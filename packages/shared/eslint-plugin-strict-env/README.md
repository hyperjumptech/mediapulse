# `@workspace/eslint-plugin-strict-env`

## Rules

### `no-process-env`

Disallows direct access to `process.env` and suggests using a safe import path instead.

#### Options

```javascript
{
  "strict-env/no-process-env": ["error", {
    "envPaths": ["@hermes/env", "@mediapulse/env"]
  }]
}
```

- `envPaths` (string[], default: `["@hermes/env", "@mediapulse/env"]`): Import paths that count as typed `env` imports. Use a **single** entry if you want ESLint to auto-insert that import when fixing `process.env.*`.
- `envPath` (string, optional): Legacy single path; equivalent to `envPaths: [envPath]`.

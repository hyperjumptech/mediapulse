import { config as baseConfig } from "@workspace/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
  },
  {
    files: ["src/lib/profiles.ts"],
    rules: {
      // MCP profiles use Cursor-supplied HERMES_MCP_PROFILE_* env vars (not @hermes/env).
      "strict-env/no-process-env": "off",
    },
  },
];

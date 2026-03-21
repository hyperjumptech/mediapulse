import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import strictEnv from "eslint-plugin-strict-env";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      "strict-env": strictEnv,
    },
    rules: {
      "strict-env/no-process-env": "error",
    },
  },
  {
    ignores: ["dist/**"],
  },
];

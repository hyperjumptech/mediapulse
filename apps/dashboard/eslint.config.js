import { globalIgnores } from "eslint/config"
import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  globalIgnores([".next/**", "out/**", "build/**"]),
  ...nextJsConfig,
]

import { readFileSync } from "node:fs";

const PACKAGE_JSON_URL = new URL("../../package.json", import.meta.url);

const FALLBACK_VERSION = "0.0.0";

export const parsePackageVersion = (packageJsonText: string): string => {
  const packageJson = JSON.parse(packageJsonText) as { version?: unknown };

  return typeof packageJson.version === "string"
    ? packageJson.version
    : FALLBACK_VERSION;
};

export const readServerVersion = (
  readPackageJson: () => string = () => readFileSync(PACKAGE_JSON_URL, "utf8"),
): string => parsePackageVersion(readPackageJson());

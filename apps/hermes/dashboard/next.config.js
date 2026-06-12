// apps/hermes/dashboard/next.config.js
import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hermesEnvDir = path.resolve(__dirname, "../../../packages/hermes/env");
loadEnvConfig(hermesEnvDir);

const extensionPackage = process.env.HERMES_DASHBOARD_EXTENSIONS?.trim();
const extensionPackageRoot = extensionPackage?.replace(/\/[^/]+$/, "");
const extensionEnvDir = process.env.HERMES_DASHBOARD_EXTENSIONS_ENV_DIR?.trim();
if (extensionEnvDir) {
  loadEnvConfig(path.resolve(extensionEnvDir));
}

const monorepoRoot = path.resolve(__dirname, "../../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@hermes/dashboard-extensions",
    ...(extensionPackageRoot ? [extensionPackageRoot] : []),
    "@workspace/agent-auth-client",
    "@workspace/json-schema-form",
  ],
  outputFileTracingRoot: monorepoRoot,
  // Resolve workspace packages from monorepo root (required for Turbopack in Docker/CI)
  turbopack: {
    root: monorepoRoot,
  },
  serverExternalPackages: extensionPackage ? [extensionPackage] : [],
};

export default nextConfig;

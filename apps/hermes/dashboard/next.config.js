// apps/hermes/dashboard/next.config.js
import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hermesEnvDir = path.resolve(__dirname, "../../../packages/hermes/env");
loadEnvConfig(hermesEnvDir);

const monorepoRoot = path.resolve(__dirname, "../../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  transpilePackages: [
    "@workspace/agent-auth-client",
    "@workspace/json-schema-form",
  ],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;

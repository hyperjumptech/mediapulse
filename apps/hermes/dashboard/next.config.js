// apps/hermes/dashboard/next.config.js
import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hermesEnvDir = path.resolve(__dirname, "../../../packages/hermes/env");
const mediapulseEnvDir = path.resolve(
  __dirname,
  "../../../packages/mediapulse/env",
);
loadEnvConfig(hermesEnvDir);
loadEnvConfig(mediapulseEnvDir);

const monorepoRoot = path.resolve(__dirname, "../../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@mediapulse/hermes-dashboard",
    "@workspace/agent-auth-client",
    "@workspace/json-schema-form",
  ],
  outputFileTracingRoot: monorepoRoot,
  // Resolve workspace packages from monorepo root (required for Turbopack in Docker/CI)
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;

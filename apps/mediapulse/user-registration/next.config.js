// apps/mediapulse/user-registration/next.config.js
import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envDir = path.resolve(__dirname, "../../../packages/mediapulse/env");
const monorepoRoot = path.resolve(__dirname, "../../..");

loadEnvConfig(envDir);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@workspace/email-templates"],
  turbopack: {
    root: monorepoRoot,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;

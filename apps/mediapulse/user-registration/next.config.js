// apps/mediapulse/user-registration/next.config.js
import path from "path";
import { fileURLToPath } from "url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envDir = path.resolve(__dirname, "../../../packages/shared/env");

loadEnvConfig(envDir);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../../.."),
};

export default nextConfig;

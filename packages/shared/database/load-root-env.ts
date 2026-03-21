import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

/** Repo root `.env` when Prisma runs with cwd = `packages/shared/database`. */
loadDotenv({ path: resolve(process.cwd(), "../../../.env") });

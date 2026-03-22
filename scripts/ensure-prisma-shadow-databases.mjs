/**
 * Creates prisma_shadow_orchestration and prisma_shadow_mediapulse when missing.
 * Uses ORCHESTRATION_DATABASE_URL from packages/hermes/env/.env (maintenance DB: postgres).
 *
 * If CREATE DATABASE fails (role lacks CREATEDB), retries via `docker compose exec`
 * (`ALTER ROLE` / `CREATEDB` as `POSTGRES_USER`). If TCP still fails afterward, creates
 * shadow DBs with `psql` inside the container — common when `localhost:5432` hits a
 * different Postgres than Docker (e.g. Homebrew vs Compose).
 *
 * @returns Promise<void>
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(
  join(root, "packages/hermes/orchestration-database/package.json"),
);
const { Client } = require("pg");

const SHADOW_DBS = ["prisma_shadow_orchestration", "prisma_shadow_mediapulse"];

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

/**
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * @param {string} s
 * @returns {string}
 */
function ident(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

/**
 * @param {import("pg").Client} client
 * @param {string} owner
 * @returns Promise<void>
 */
async function createShadowDatabases(client, owner) {
  for (const name of SHADOW_DBS) {
    const check = await client.query(
      "SELECT 1 AS x FROM pg_database WHERE datname = $1",
      [name],
    );
    if (check.rowCount && check.rowCount > 0) continue;
    console.log(`  Creating Prisma shadow database: ${name}`);
    await client.query(`CREATE DATABASE ${ident(name)} OWNER ${ident(owner)}`);
  }
}

/**
 * Grants CREATEDB to the app role using psql inside the local `postgres` Compose service.
 * Matches docker-compose.yml where `POSTGRES_USER` is the cluster superuser (not `postgres`).
 *
 * @param {string} owner Database role name from ORCHESTRATION_DATABASE_URL (must match POSTGRES_USER for local Docker).
 * @returns {boolean} true if docker compose ran successfully
 */
function grantCreatedbViaDockerCompose(owner) {
  const compose = join(root, "docker-compose.yml");
  if (!existsSync(compose)) return false;
  const sql = `ALTER USER ${ident(owner)} CREATEDB;`;
  /** Shell script run inside the container (POSTGRES_* are set by the image). */
  const inner = `PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d template1 -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`;
  try {
    execFileSync(
      "docker",
      ["compose", "-f", compose, "exec", "-T", "postgres", "sh", "-c", inner],
      { stdio: "inherit" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs a single SQL statement via psql inside the Compose `postgres` service (captures stdout).
 *
 * @param {string} compose Absolute path to docker-compose.yml
 * @param {string} sql
 * @returns {string}
 */
function dockerComposeExecPsql(compose, sql) {
  const inner = `PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d template1 -At -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`;
  return execFileSync(
    "docker",
    ["compose", "-f", compose, "exec", "-T", "postgres", "sh", "-c", inner],
    { encoding: "utf8" },
  );
}

/**
 * Creates missing shadow DBs inside the Docker Postgres cluster (not over TCP from the host).
 *
 * @param {string} owner Role name; must be a simple identifier (URL username).
 * @returns {boolean} true if docker compose ran for every DB
 */
function createShadowDatabasesViaDockerCompose(owner) {
  const compose = join(root, "docker-compose.yml");
  if (!existsSync(compose)) return false;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner)) return false;
  try {
    for (const name of SHADOW_DBS) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return false;
      const checkSql = `SELECT 1 FROM pg_database WHERE datname = '${name}';`;
      const exists = dockerComposeExecPsql(compose, checkSql).trim();
      if (exists === "1") continue;
      console.log(`  Creating Prisma shadow database (via Docker): ${name}`);
      dockerComposeExecPsql(
        compose,
        `CREATE DATABASE ${ident(name)} OWNER ${ident(owner)};`,
      );
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const envPath = join(root, "packages/hermes/env/.env");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error(`Missing ${envPath}; run ./dev-bootstrap.sh first.`);
    process.exit(1);
  }

  const env = parseEnvFile(raw);
  const mainUrl = env.ORCHESTRATION_DATABASE_URL;
  if (!mainUrl) {
    console.error(
      "ORCHESTRATION_DATABASE_URL not set in packages/hermes/env/.env",
    );
    process.exit(1);
  }

  const u = new URL(mainUrl);
  if (!LOCAL_HOSTS.has(u.hostname)) {
    console.warn(
      `ORCHESTRATION_DATABASE_URL host is "${u.hostname}" — skipping shadow DB auto-create (local dev only).`,
    );
    console.warn(
      "Create manually: CREATE DATABASE prisma_shadow_orchestration OWNER …; CREATE DATABASE prisma_shadow_mediapulse OWNER …;",
    );
    process.exit(0);
  }

  const admin = new URL(mainUrl);
  admin.pathname = "/postgres";

  const owner = u.username;

  const runCreates = async () => {
    const client = new Client({ connectionString: admin.toString() });
    await client.connect();
    try {
      await createShadowDatabases(client, owner);
    } finally {
      await client.end();
    }
  };

  try {
    await runCreates();
  } catch (e) {
    const err = /** @type {NodeJS.ErrnoException & { code?: string }} */ (e);
    if (err.code !== "42501") {
      console.error(e);
      process.exit(1);
    }
    console.warn(
      "  Permission denied to CREATE DATABASE — retrying via Docker Compose (psql as POSTGRES_USER + CREATEDB)…",
    );
    if (!grantCreatedbViaDockerCompose(owner)) {
      console.error(
        "Could not fix permissions automatically. As a PostgreSQL superuser run:",
      );
      console.error("  ALTER USER mediapulse CREATEDB;");
      console.error(
        "Then re-run ./dev-setup-local.sh or create the shadow DBs manually.",
      );
      process.exit(1);
    }
    try {
      await runCreates();
    } catch (e2) {
      const err2 = /** @type {NodeJS.ErrnoException & { code?: string }} */ (
        e2
      );
      if (err2.code !== "42501") {
        console.error(e2);
        process.exit(1);
      }
      console.warn(
        "  Still cannot CREATE DATABASE over TCP — creating shadow DBs inside the Docker Compose postgres service…",
      );
      if (!createShadowDatabasesViaDockerCompose(owner)) {
        console.error(
          "Could not create shadow databases via Docker. Start Postgres with: docker compose up -d postgres",
        );
        process.exit(1);
      }
      try {
        await runCreates();
      } catch (e3) {
        const err3 = /** @type {NodeJS.ErrnoException & { code?: string }} */ (
          e3
        );
        console.error(e3);
        if (err3.code === "42501") {
          console.error("");
          console.error(
            "Likely cause: ORCHESTRATION_DATABASE_URL points at a different PostgreSQL than the Docker Compose",
            "container (two servers on the same host/port). Stop the other Postgres, or change the URL port to",
            "match `docker compose` (see `docker compose port postgres 5432`).",
          );
        }
        process.exit(1);
      }
    }
  }
}

await main();

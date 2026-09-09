import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { derivePublisherFromUrl } from "@workspace/utils";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadMediapulseScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../../env/.env");
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
};

async function main() {
  loadMediapulseScriptEnv();

  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/client");

  const grouped = await prisma.dataSource.groupBy({
    by: ["registrableDomain"],
    where: { registrableDomain: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });
  const existing = await prisma.publisher.findMany({
    select: { domain: true },
  });
  const known = new Set(existing.map((row) => row.domain));
  const missing = grouped.filter(
    (row) =>
      row.registrableDomain !== null && !known.has(row.registrableDomain),
  );

  console.log(
    `${grouped.length} distinct domain(s) in data_source, ${known.size} already in publisher, ${missing.length} to seed.${
      apply ? "" : " Dry run: pass --apply to write."
    }`,
  );

  console.log("\nTop domains by article count:");
  for (const row of grouped.slice(0, 50)) {
    const domain = row.registrableDomain ?? "";
    const marker = known.has(domain) ? "have" : "seed";
    console.log(
      `  ${String(row._count._all).padStart(6)}  ${marker}  ${domain}  ->  ${derivePublisherFromUrl(`https://${domain}`)}`,
    );
  }

  if (!apply) {
    return;
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;
  for (const row of missing) {
    const domain = row.registrableDomain;
    if (domain === null) {
      continue;
    }
    const displayName = derivePublisherFromUrl(`https://${domain}`);
    if (displayName === "") {
      skipped += 1;
      continue;
    }

    await prisma.publisher.create({
      data: { domain, displayName, nameSource: "derived", lastSeenAt: now },
    });
    created += 1;
  }

  console.log(
    `\nSeeded ${created} publisher row(s); skipped ${skipped} domain(s) with no derivable name.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

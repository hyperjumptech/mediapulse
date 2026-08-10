import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { deriveRegistrableDomain } from "@workspace/utils";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCH_SIZE = 500;

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

  const pending = await prisma.dataSource.count({
    where: { registrableDomain: null },
  });
  console.log(
    `${pending} data_source row(s) without a registrable domain.${
      apply ? "" : " Dry run: pass --apply to write."
    }`,
  );

  let cursor: string | undefined;
  let scanned = 0;
  let resolved = 0;
  let updated = 0;
  let unparsable = 0;

  while (true) {
    const rows = await prisma.dataSource.findMany({
      where: { registrableDomain: null },
      select: { id: true, url: true, canonicalUrl: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (rows.length === 0) {
      break;
    }

    cursor = rows[rows.length - 1]?.id;
    scanned += rows.length;

    const idsByDomain = new Map<string, string[]>();
    for (const row of rows) {
      const domain = deriveRegistrableDomain(row.canonicalUrl || row.url);
      if (domain === "") {
        unparsable += 1;
        continue;
      }
      const bucket = idsByDomain.get(domain) ?? [];
      bucket.push(row.id);
      idsByDomain.set(domain, bucket);
    }

    for (const [domain, ids] of idsByDomain) {
      resolved += ids.length;
      if (!apply) {
        continue;
      }
      const result = await prisma.dataSource.updateMany({
        where: { id: { in: ids }, registrableDomain: null },
        data: { registrableDomain: domain },
      });
      updated += result.count;
    }

    console.log(
      `  scanned ${scanned}, resolved ${resolved}, updated ${updated}, unparsable ${unparsable}`,
    );
  }

  console.log(
    `Backfill ${apply ? "complete" : "dry run complete"}. scanned=${scanned} resolved=${resolved} updated=${updated} unparsable=${unparsable}`,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});

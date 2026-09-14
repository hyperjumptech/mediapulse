import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { canonicalizeUrl } from "@workspace/utils";
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

  const total = await prisma.dataSource.count();
  console.log(
    `${total} data_source row(s) to re-canonicalize.${
      apply ? "" : " Dry run: pass --apply to write."
    }`,
  );

  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;
  let updated = 0;
  let unparsable = 0;

  while (true) {
    const rows = await prisma.dataSource.findMany({
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

    for (const row of rows) {
      let canonical: string;
      try {
        canonical = canonicalizeUrl(row.url);
      } catch {
        unparsable += 1;
        continue;
      }
      if (canonical === row.canonicalUrl) {
        continue;
      }
      changed += 1;
      if (!apply) {
        continue;
      }
      await prisma.dataSource.update({
        where: { id: row.id },
        data: { canonicalUrl: canonical },
      });
      updated += 1;
    }

    console.log(
      `  scanned ${scanned}, changed ${changed}, updated ${updated}, unparsable ${unparsable}`,
    );
  }

  console.log(
    `Backfill ${apply ? "complete" : "dry run complete"}. scanned=${scanned} changed=${changed} updated=${updated} unparsable=${unparsable}`,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});

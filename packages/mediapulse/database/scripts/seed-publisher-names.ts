import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CURATED_PUBLISHER_NAMES: Record<string, string> = {
  "cnbcindonesia.com": "CNBC Indonesia",
  "kontan.co.id": "Kontan",
  "antaranews.com": "ANTARA News",
  "liputan6.com": "Liputan6",
  "detik.com": "detikcom",
  "kompas.com": "Kompas.com",
  "kompas.id": "Kompas",
  "kompas.tv": "Kompas TV",
  "bloombergtechnoz.com": "Bloomberg Technoz",
  "cnnindonesia.com": "CNN Indonesia",
  "bisnis.com": "Bisnis Indonesia",
  "katadata.co.id": "Katadata",
  "mediaindonesia.com": "Media Indonesia",
  "investor.id": "Investor Daily",
  "sindonews.com": "SINDOnews",
  "sindomakassar.com": "SINDO Makassar",
  "tempo.co": "Tempo",
  "idntimes.com": "IDN Times",
  "infobanknews.com": "Infobank News",
  "viva.co.id": "VIVA",
  "wartaekonomi.co.id": "Warta Ekonomi",
  "investortrust.id": "Investor Trust",
  "republika.co.id": "Republika",
  "kumparan.com": "kumparan",
  "jawapos.com": "Jawa Pos",
  "suara.com": "Suara.com",
  "suaramerdeka.com": "Suara Merdeka",
  "rri.co.id": "RRI",
  "swa.co.id": "SWA",
  "idxchannel.com": "IDX Channel",
  "okezone.com": "Okezone",
  "disway.id": "Disway",
  "emitennews.com": "EmitenNews",
  "idnfinancials.com": "IDN Financials",
  "kabarbursa.com": "Kabar Bursa",
  "kabarbisnis.com": "Kabar Bisnis",
  "tribunnews.com": "Tribunnews",
  "metrotvnews.com": "Metro TV News",
  "tvonenews.com": "tvOne News",
  "ntvnews.id": "NTV News",
  "voi.id": "VOI",
  "rctiplus.com": "RCTI+",
  "rm.id": "Rakyat Merdeka",
  "rmol.id": "RMOL",
  "koran-jakarta.com": "Koran Jakarta",
  "stabilitas.id": "Stabilitas",
  "pasardana.id": "Pasar Dana",
  "pikiran-rakyat.com": "Pikiran Rakyat",
  "beritasatu.com": "BeritaSatu",
  "inilah.com": "Inilah.com",
  "validnews.id": "Validnews",
  "akurat.co": "Akurat",
  "stockwatch.id": "Stockwatch",
  "trenasia.id": "TrenAsia",
  "jpnn.com": "JPNN",
  "fortuneidn.com": "Fortune Indonesia",
  "tirto.id": "Tirto",
  "medcom.id": "Medcom",
  "ipotnews.com": "IPOT News",
  "indotelko.com": "IndoTelko",
  "fajar.co.id": "Fajar",
  "bareksa.com": "Bareksa",
  "pluang.com": "Pluang",
  "ajaib.co.id": "Ajaib",
  "topbusiness.id": "TopBusiness",
  "theiconomics.com": "The Iconomics",
  "majalahict.com": "Majalah ICT",
  "olenka.id": "Olenka",
  "nusabali.com": "NusaBali",
  "youngster.id": "Youngster.id",
  "dunia-energi.com": "Dunia Energi",
  "listrikindonesia.com": "Listrik Indonesia",
  "konstruksimedia.com": "Konstruksi Media",
  "sinarharapan.co": "Sinar Harapan",
  "ojk.go.id": "OJK",
  "bca.co.id": "BCA",
  "investing.com": "Investing.com",
  "tradingview.com": "TradingView",
  "msn.com": "MSN",
  "yahoo.com": "Yahoo",
  "kompasiana.com": "Kompasiana",
  "headtopics.com": "HeadTopics",
};

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

  const domains = Object.keys(CURATED_PUBLISHER_NAMES);
  const existing = await prisma.publisher.findMany({
    where: { domain: { in: domains } },
    select: { domain: true, displayName: true, nameSource: true },
  });
  const existingByDomain = new Map(existing.map((row) => [row.domain, row]));

  console.log(
    `${domains.length} curated name(s); ${existing.length} already have a publisher row.${
      apply ? "" : " Dry run: pass --apply to write."
    }\n`,
  );

  for (const [domain, displayName] of Object.entries(CURATED_PUBLISHER_NAMES)) {
    const current = existingByDomain.get(domain);
    const from = current === undefined ? "(new row)" : current.displayName;
    console.log(`  ${domain.padEnd(24)} ${from.padEnd(22)} -> ${displayName}`);
  }

  if (!apply) {
    return;
  }

  const now = new Date();
  let created = 0;
  let updated = 0;
  for (const [domain, displayName] of Object.entries(CURATED_PUBLISHER_NAMES)) {
    const result = await prisma.publisher.upsert({
      where: { domain },
      create: {
        domain,
        displayName,
        nameSource: "manual",
        lastSeenAt: now,
      },
      update: { displayName, nameSource: "manual" },
      select: { createdAt: true, updatedAt: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`\nCreated ${created} row(s), updated ${updated} row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

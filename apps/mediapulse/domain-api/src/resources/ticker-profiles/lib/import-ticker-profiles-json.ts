import { prisma } from "@mediapulse/database";
import { z } from "zod";

const namedEntitySchema = z.object({
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
});

const localizedLabelSchema = z.object({
  id: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const tickerProfileRowSchema = z.object({
  symbol: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  company_overview: z.string().trim().min(1),
  business_operation: z.string().trim().min(1),
  sector: localizedLabelSchema,
  sub_sector: localizedLabelSchema,
  industry: localizedLabelSchema,
  sub_industry: localizedLabelSchema,
  competitors: z.array(namedEntitySchema).default([]),
  regulators: z.array(namedEntitySchema).default([]),
});

const tickerProfilePayloadSchema = z.union([
  z.array(tickerProfileRowSchema),
  z.object({ data: z.array(tickerProfileRowSchema) }),
]);

const importBodySchema = z.object({
  payloadJson: z.string().min(1, "Payload JSON is required"),
});

export type TickerProfileRow = z.infer<typeof tickerProfileRowSchema>;

export type TickerProfileUpsertDb = {
  ticker: {
    findUnique: (args: {
      where: { symbol: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  tickerProfile: {
    upsert: (args: {
      where: { tickerId: string };
      create: TickerProfileWriteData & { tickerId: string };
      update: TickerProfileWriteData;
      select: { id: true };
    }) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { tickerId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

type TickerProfileWriteData = {
  companyOverview: string;
  businessOperation: string;
  sectorIndonesian: string;
  sectorEnglish: string;
  subSectorIndonesian: string;
  subSectorEnglish: string;
  industryIndonesian: string;
  industryEnglish: string;
  subIndustryIndonesian: string;
  subIndustryEnglish: string;
  aliases: string[];
  competitors: { name: string; aliases: string[] }[];
  regulators: { name: string; aliases: string[] }[];
};

export type ImportTickerProfilesResult = {
  added: number;
  updated: number;
  skipped: string[];
};

export type ImportTickerProfilesJsonDependencies = {
  db?: TickerProfileUpsertDb;
};

export type ImportTickerProfilesJsonResult =
  | ({ ok: true } & ImportTickerProfilesResult)
  | { ok: false; status: 400; message: string };

export const mapRowToProfileData = (
  row: TickerProfileRow,
): TickerProfileWriteData => ({
  companyOverview: row.company_overview.trim(),
  businessOperation: row.business_operation.trim(),
  sectorIndonesian: row.sector.id.trim(),
  sectorEnglish: row.sector.en.trim(),
  subSectorIndonesian: row.sub_sector.id.trim(),
  subSectorEnglish: row.sub_sector.en.trim(),
  industryIndonesian: row.industry.id.trim(),
  industryEnglish: row.industry.en.trim(),
  subIndustryIndonesian: row.sub_industry.id.trim(),
  subIndustryEnglish: row.sub_industry.en.trim(),
  aliases: row.aliases,
  competitors: row.competitors,
  regulators: row.regulators,
});

export const importTickerProfiles = async (
  rows: TickerProfileRow[],
  db: TickerProfileUpsertDb,
): Promise<ImportTickerProfilesResult> => {
  let added = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    const symbol = row.symbol.trim().toUpperCase();
    const ticker = await db.ticker.findUnique({
      where: { symbol },
      select: { id: true },
    });
    if (ticker === null) {
      skipped.push(symbol);
      continue;
    }

    const existing = await db.tickerProfile.findUnique({
      where: { tickerId: ticker.id },
      select: { id: true },
    });
    const data = mapRowToProfileData(row);
    await db.tickerProfile.upsert({
      where: { tickerId: ticker.id },
      create: { tickerId: ticker.id, ...data },
      update: data,
      select: { id: true },
    });

    if (existing === null) {
      added += 1;
    } else {
      updated += 1;
    }
  }

  return { added, updated, skipped };
};

export const importTickerProfilesFromRequestBody = async (
  body: unknown,
  dependencies: ImportTickerProfilesJsonDependencies = {},
): Promise<ImportTickerProfilesJsonResult> => {
  const parseBody = importBodySchema.safeParse(body);
  if (!parseBody.success) {
    return { ok: false, status: 400, message: "Invalid request body" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(parseBody.data.payloadJson) as unknown;
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }

  const parsePayload = tickerProfilePayloadSchema.safeParse(parsedJson);
  if (!parsePayload.success) {
    return {
      ok: false,
      status: 400,
      message:
        "Invalid ticker profile payload: array of rows with symbol, company_overview, business_operation, sector, sub_sector, industry, sub_industry required",
    };
  }

  const rows = Array.isArray(parsePayload.data)
    ? parsePayload.data
    : parsePayload.data.data;
  const db = (dependencies.db ?? prisma) as unknown as TickerProfileUpsertDb;
  const result = await importTickerProfiles(rows, db);

  return { ok: true, ...result };
};

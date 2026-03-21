import {
  dashboardManifestSchema,
  domainHealthResponseSchema,
  expandStepInputsRequestSchema,
  previewExpansionRequestSchema,
  registerDomainIntegrationRequestSchema,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import { MAX_TAKE, parseDataSourceString } from "@hermes/step-input-syntax";
import { env } from "@mediapulse/env";
import { logger } from "@workspace/logger";
import {
  expandDataSources,
  expandSingleDataSource,
} from "@mediapulse/hermes-integration";
import { prisma, Prisma } from "@mediapulse/database";
import { importIdxTickersFromRequestBody } from "./import-idx-tickers-json";
import { mergeTickerMetadataForPatch } from "./merge-ticker-metadata";
import { parseTickerMetadataJson } from "./parse-ticker-metadata-json";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { z } from "zod";

const app = new Hono();
const api = app.basePath("/v1");

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;
const REGISTRATION_MAX_ATTEMPTS = 6;
const REGISTRATION_INITIAL_DELAY_MS = 1_000;
const REGISTRATION_MAX_DELAY_MS = 30_000;

const tickerMetadataBodySchema = z
  .union([z.string(), z.record(z.string(), z.unknown()), z.null()])
  .optional();

const tickerCreateSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  metadata: tickerMetadataBodySchema,
});

const tickerUpdateSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  metadata: tickerMetadataBodySchema,
});

const entityTypeCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const entityTypeUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const relationTypeCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const relationTypeUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const dataSourceExpansionCreateSchema = z.object({
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
});

const dataSourceExpansionUpdateSchema = z.object({
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
});

/**
 * JSON Schema `properties` for ticker `metadata` (IDX-style emiten row).
 * Hermes renders one control per key; keys omitted here stay in DB via PATCH merge but are not editable in the UI.
 */
const tickerMetadataFormProperties: Record<string, unknown> = {
  id: { type: "integer", title: "ID (IDX)" },
  BAE: { type: "string", title: "BAE", nullable: true },
  Fax: { type: "string", title: "Fax", nullable: true },
  Logo: { type: "string", title: "Logo", nullable: true },
  NPKP: { type: "string", title: "NPKP", nullable: true },
  NPWP: { type: "string", title: "NPWP", nullable: true },
  Email: { type: "string", title: "Email", nullable: true },
  Alamat: {
    type: "string",
    title: "Alamat",
    format: "textarea",
    nullable: true,
  },
  DataID: { type: "integer", title: "Data ID" },
  Divisi: { type: "string", title: "Divisi", nullable: true },
  Sektor: { type: "string", title: "Sektor", nullable: true },
  Status: { type: "integer", title: "Status" },
  Telepon: { type: "string", title: "Telepon", nullable: true },
  Website: { type: "string", title: "Website", nullable: true },
  Industri: { type: "string", title: "Industri", nullable: true },
  SubSektor: { type: "string", title: "Sub-sektor", nullable: true },
  KodeDivisi: { type: "string", title: "Kode divisi", nullable: true },
  KodeEmiten: { type: "string", title: "Kode emiten", nullable: true },
  NamaEmiten: { type: "string", title: "Nama emiten", nullable: true },
  JenisEmiten: { type: "string", title: "Jenis emiten", nullable: true },
  SubIndustri: { type: "string", title: "Sub-industri", nullable: true },
  EfekEmiten_EBA: { type: "boolean", title: "Efek: EBA" },
  EfekEmiten_ETF: { type: "boolean", title: "Efek: ETF" },
  EfekEmiten_SPEI: { type: "boolean", title: "Efek: SPEI" },
  PapanPencatatan: {
    type: "string",
    title: "Papan pencatatan",
    nullable: true,
  },
  EfekEmiten_Saham: { type: "boolean", title: "Efek: Saham" },
  TanggalPencatatan: {
    type: "string",
    title: "Tanggal pencatatan",
    format: "date-time",
    nullable: true,
  },
  KegiatanUsahaUtama: {
    type: "string",
    title: "Kegiatan usaha utama",
    format: "textarea",
    nullable: true,
  },
  EfekEmiten_Obligasi: { type: "boolean", title: "Efek: Obligasi" },
};

const dashboardManifest = dashboardManifestSchema.parse({
  templateVersion: 1,
  pages: [
    {
      id: "tickers",
      label: "Tickers",
      description: "Manage ticker symbols and company names for data sources.",
      pathSegment: "tickers",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/tickers",
      order: 10,
      columns: [
        { key: "symbol", label: "Symbol", type: "text" },
        { key: "name", label: "Name", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["symbol", "name"],
      sortableFields: ["symbol", "name", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createSchema: {
        type: "object",
        required: ["symbol", "name"],
        properties: {
          symbol: { type: "string", title: "Symbol" },
          name: { type: "string", title: "Name" },
          metadata: {
            type: "object",
            title: "Metadata",
            nullable: true,
            properties: tickerMetadataFormProperties,
          },
        },
      },
      updateSchema: {
        type: "object",
        required: ["symbol", "name"],
        properties: {
          symbol: { type: "string", title: "Symbol" },
          name: { type: "string", title: "Name" },
          metadata: {
            type: "object",
            title: "Metadata",
            nullable: true,
            properties: tickerMetadataFormProperties,
          },
        },
      },
      customActions: [
        {
          id: "import-idx-json",
          label: "Import IDX JSON",
          description:
            "Upload a JSON file in IDX company profiles format (object with a data array).",
          ui: "json-file-upload",
          method: "POST",
          path: "/import-idx-json",
          accept: ".json,application/json",
        },
      ],
    },
    {
      id: "entity-types",
      label: "Entity Types",
      description:
        "Manage vocabulary used by the knowledge graph entity classifier.",
      pathSegment: "entity-types",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/entity-types",
      order: 20,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description"],
      sortableFields: ["name", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Name" },
          description: { type: "string", title: "Description" },
        },
      },
      updateSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Name" },
          description: { type: "string", title: "Description" },
        },
      },
    },
    {
      id: "relation-types",
      label: "Relation Types",
      description:
        "Manage vocabulary used by the knowledge graph relation classifier.",
      pathSegment: "relation-types",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/relation-types",
      order: 30,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description"],
      sortableFields: ["name", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Name" },
          description: { type: "string", title: "Description" },
        },
      },
      updateSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Name" },
          description: { type: "string", title: "Description" },
        },
      },
    },
    {
      id: "search-queries",
      label: "Search Query",
      description: "Manage generated search queries and remove unused rows.",
      pathSegment: "search-queries",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/search-queries",
      order: 40,
      columns: [
        { key: "tickerSymbol", label: "Ticker", type: "text" },
        { key: "tickerName", label: "Ticker Name", type: "text" },
        { key: "text", label: "Search Query", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["tickerName", "tickerSymbol", "text"],
      sortableFields: ["createdAt"],
      actions: { create: false, update: false, delete: true },
    },
    {
      id: "data-source-expansions",
      label: "Data source expansions",
      description:
        "Manage reusable db: expansion aliases used in pipeline inputs.",
      pathSegment: "data-source-expansions",
      template: "table-v1",
      apiPrefix: "/v1/hermes-dashboard/data-source-expansions",
      order: 50,
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "expansionString", label: "Expansion string", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "createdAt", label: "Created", type: "date-time" },
      ],
      searchableFields: ["name", "description", "expansionString"],
      sortableFields: ["name", "createdAt"],
      actions: { create: true, update: true, delete: true },
      createNavigation: "full-page",
      preview: { enabled: true, fieldKey: "expansionString" },
      createSchema: {
        type: "object",
        required: ["name", "expansionString"],
        properties: {
          name: { type: "string", title: "Name" },
          expansionString: { type: "string", title: "Expansion string" },
          description: { type: "string", title: "Description" },
        },
      },
      updateSchema: {
        type: "object",
        required: ["name", "expansionString"],
        properties: {
          name: { type: "string", title: "Name" },
          expansionString: { type: "string", title: "Expansion string" },
          description: { type: "string", title: "Description" },
        },
      },
    },
  ],
});

/**
 * Parses common list pagination params for table-v1 endpoints.
 *
 * @param pageRaw - Raw page value from query string.
 * @param pageSizeRaw - Raw page-size value from query string.
 * @returns Parsed page and page size values.
 */
/** Max length for preview-expansion error strings returned to Hermes (admin UI). */
const MAX_PREVIEW_EXPANSION_ERROR_LEN = 800;

/**
 * Trims and caps error text for preview API responses.
 *
 * @param message - Raw error message.
 * @returns Safe-length string for JSON `error` field.
 */
const truncatePreviewExpansionError = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_PREVIEW_EXPANSION_ERROR_LEN) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PREVIEW_EXPANSION_ERROR_LEN)}…`;
};

const parsePagination = (
  pageRaw: string | undefined,
  pageSizeRaw: string | undefined,
): { page: number; pageSize: number } => {
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(pageSizeRaw ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  return { page, pageSize };
};

/**
 * Converts optional string values to nullable trimmed values.
 *
 * @param value - Optional string or null.
 * @returns Trimmed string or null.
 */
const nullableText = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Waits for a specified delay.
 *
 * @param delayMs - Milliseconds to wait.
 * @returns Promise that resolves after the delay.
 */
const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

/**
 * Returns the exponential backoff delay for a registration attempt.
 *
 * @param attempt - 1-based attempt number.
 * @returns Backoff delay in milliseconds, capped by max delay.
 */
const getBackoffDelayMs = (attempt: number): number => {
  const delay = REGISTRATION_INITIAL_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, REGISTRATION_MAX_DELAY_MS);
};

/**
 * Determines whether registration should retry for the given response status.
 *
 * @param status - HTTP status code.
 * @returns True when the status is transient and worth retrying.
 */
const shouldRetryStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};

api.use(
  pinoLogger({
    pino: logger,
    http: {
      onResBindings: (c) => ({
        res: {
          status: c.res.status,
          headers: Object.fromEntries(c.res.headers.entries()),
        },
      }),
    },
  }),
);

if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
  api.use(
    "*",
    bearerAuth({
      verifyToken: (token) => token === env.DOMAIN_INTEGRATION_AUTH_TOKEN,
    }),
  );
}

api.get("/health", (c) => {
  const response = domainHealthResponseSchema.parse({
    ok: true,
    service: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    version: env.DOMAIN_INTEGRATION_VERSION,
  });
  return c.json(response);
});

api.get("/hermes-dashboard/manifest", (c) => {
  return c.json(dashboardManifest);
});

api.get("/hermes-dashboard/:resource/meta", (c) => {
  const resource = c.req.param("resource");
  const page = dashboardManifest.pages.find(
    (entry) => entry.pathSegment === resource,
  );
  if (!page) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const meta = tableV1MetaResponseSchema.parse({
    title: page.label,
    description: page.description,
    columns: page.columns,
    searchableFields: page.searchableFields,
    sortableFields: page.sortableFields,
    actions: page.actions,
    createSchema: page.createSchema,
    updateSchema: page.updateSchema,
    customActions: page.customActions,
    createNavigation: page.createNavigation,
    preview: page.preview,
  });

  return c.json(meta);
});

api.get("/hermes-dashboard/tickers", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { symbol: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      } satisfies Prisma.TickerWhereInput)
    : undefined;
  const orderBy =
    sortBy === "name"
      ? { name: sortDir }
      : sortBy === "createdAt"
        ? { createdAt: sortDir }
        : { symbol: sortDir };

  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.TickerFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.ticker.findMany(findManyArgs),
    prisma.ticker.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      metadata:
        row.metadata === null || row.metadata === undefined
          ? ""
          : JSON.stringify(row.metadata, null, 2),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

api.post("/hermes-dashboard/tickers", async (c) => {
  const body = tickerCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const metadataParsed = parseTickerMetadataJson(body.data.metadata);
  if (!metadataParsed.ok) {
    return c.json({ message: metadataParsed.message }, 400);
  }

  const created = await prisma.ticker.create({
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
      ...(metadataParsed.value !== undefined
        ? {
            metadata:
              metadataParsed.value === null
                ? Prisma.DbNull
                : metadataParsed.value,
          }
        : {}),
    },
  });
  return c.json({ id: created.id }, 201);
});

api.post("/hermes-dashboard/tickers/import-idx-json", async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const result = await importIdxTickersFromRequestBody(jsonBody);
  if (!result.ok) {
    return c.json({ message: result.message }, result.status);
  }

  return c.json({ added: result.added, updated: result.updated });
});

api.patch("/hermes-dashboard/tickers/:id", async (c) => {
  const body = tickerUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const metadataParsed = parseTickerMetadataJson(body.data.metadata);
  if (!metadataParsed.ok) {
    return c.json({ message: metadataParsed.message }, 400);
  }

  const existing = await prisma.ticker.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true, metadata: true },
  });
  if (!existing) {
    return c.json({ message: "Ticker not found" }, 404);
  }

  const mergedMetadata = mergeTickerMetadataForPatch(
    existing.metadata,
    metadataParsed.ok ? metadataParsed.value : undefined,
  );

  const updated = await prisma.ticker.update({
    where: { id: c.req.param("id") },
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    },
  });
  return c.json({ id: updated.id });
});

api.delete("/hermes-dashboard/tickers/:id", async (c) => {
  const result = await prisma.ticker.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Ticker not found" }, 404);
  }
  return c.json({ ok: true });
});

api.get("/hermes-dashboard/entity-types", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ],
      } satisfies Prisma.EntityTypeWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.entityType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.entityType.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

api.post("/hermes-dashboard/entity-types", async (c) => {
  const body = entityTypeCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.entityType.create({
    data: {
      name: body.data.name.trim(),
      description: nullableText(body.data.description),
    },
  });
  return c.json({ id: created.id }, 201);
});

api.patch("/hermes-dashboard/entity-types/:id", async (c) => {
  const body = entityTypeUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.entityType.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Entity type not found" }, 404);
  }
});

api.delete("/hermes-dashboard/entity-types/:id", async (c) => {
  const result = await prisma.entityType.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Entity type not found" }, 404);
  }
  return c.json({ ok: true });
});

api.get("/hermes-dashboard/relation-types", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ],
      } satisfies Prisma.RelationTypeWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.relationType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.relationType.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

api.post("/hermes-dashboard/relation-types", async (c) => {
  const body = relationTypeCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.relationType.create({
    data: {
      name: body.data.name.trim(),
      description: nullableText(body.data.description),
    },
  });
  return c.json({ id: created.id }, 201);
});

api.patch("/hermes-dashboard/relation-types/:id", async (c) => {
  const body = relationTypeUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.relationType.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Relation type not found" }, 404);
  }
});

api.delete("/hermes-dashboard/relation-types/:id", async (c) => {
  const result = await prisma.relationType.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Relation type not found" }, 404);
  }
  return c.json({ ok: true });
});

api.get("/hermes-dashboard/search-queries", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { text: { contains: query, mode: "insensitive" as const } },
          {
            ticker: { name: { contains: query, mode: "insensitive" as const } },
          },
          {
            ticker: {
              symbol: { contains: query, mode: "insensitive" as const },
            },
          },
        ],
      } satisfies Prisma.SearchQueryWhereInput)
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.searchQuery.findMany({
      where,
      include: {
        ticker: {
          select: {
            symbol: true,
            name: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    } satisfies Prisma.SearchQueryFindManyArgs),
    prisma.searchQuery.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      text: row.text,
      tickerSymbol: row.ticker.symbol,
      tickerName: row.ticker.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

api.delete("/hermes-dashboard/search-queries/:id", async (c) => {
  const result = await prisma.searchQuery.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Search query not found" }, 404);
  }
  return c.json({ ok: true });
});

api.get("/hermes-dashboard/data-source-expansions", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          {
            expansionString: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
        ],
      } satisfies Prisma.DataSourceExpansionWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.dataSourceExpansion.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.dataSourceExpansion.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      expansionString: row.expansionString,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

api.get("/hermes-dashboard/data-source-expansions/:id", async (c) => {
  const row = await prisma.dataSourceExpansion.findUnique({
    where: { id: c.req.param("id") },
  });
  if (!row) {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
  return c.json({
    id: row.id,
    name: row.name,
    expansionString: row.expansionString,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

api.post("/hermes-dashboard/data-source-expansions", async (c) => {
  const body = dataSourceExpansionCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.dataSourceExpansion.create({
    data: {
      name: body.data.name.trim(),
      expansionString: body.data.expansionString.trim(),
      description: nullableText(body.data.description),
      createdById: "00000000-0000-0000-0000-000000000000",
    },
  });
  return c.json({ id: created.id }, 201);
});

api.patch("/hermes-dashboard/data-source-expansions/:id", async (c) => {
  const body = dataSourceExpansionUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.dataSourceExpansion.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        expansionString: body.data.expansionString.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
});

api.delete("/hermes-dashboard/data-source-expansions/:id", async (c) => {
  const result = await prisma.dataSourceExpansion.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
  return c.json({ ok: true });
});

api.post("/preview-expansion", async (c) => {
  const parsedBody = previewExpansionRequestSchema.safeParse(
    await c.req.json(),
  );
  if (!parsedBody.success) {
    return c.json({ success: false, error: "Invalid request body" }, 400);
  }

  const parsed = parseDataSourceString(parsedBody.data.expansionString);
  if (!parsed) {
    return c.json(
      {
        success: false,
        error:
          "Invalid format. Expected db:table:field?options (e.g. where.key=value, distinct, take, orderBy)",
      },
      400,
    );
  }

  try {
    const values = await expandSingleDataSource(parsed, prisma, {
      maxTake: env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
    });
    if (values === null) {
      return c.json(
        {
          success: false,
          error: `Unknown or unsupported table: ${parsed.table}`,
        },
        400,
      );
    }

    return c.json({ success: true, values });
  } catch (e) {
    logger.error({ err: e }, "preview-expansion failed");
    const raw = e instanceof Error ? e.message : String(e);
    return c.json(
      {
        success: false,
        error: truncatePreviewExpansionError(raw),
      },
      400,
    );
  }
});

api.post("/expand-step-inputs", async (c) => {
  const parsedBody = expandStepInputsRequestSchema.safeParse(
    await c.req.json(),
  );
  if (!parsedBody.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const expandedInputs = await expandDataSources(
    parsedBody.data.input,
    prisma,
    {
      defaultTake: parsedBody.data.defaultTake,
      maxTake:
        parsedBody.data.maxTake ?? env.HERMES_DATA_SOURCE_MAX_TAKE ?? MAX_TAKE,
    },
  );

  return c.json({ expandedInputs });
});

/**
 * Registers this domain integration with Hermes.
 *
 * @returns Promise that resolves once registration call completes.
 */
const registerWithHermes = async (): Promise<void> => {
  if (
    !env.HERMES_API_URL ||
    !env.DOMAIN_INTEGRATION_REGISTRATION_API_KEY ||
    !env.MEDIAPULSE_API_URL
  ) {
    logger.info(
      "Skipping Hermes domain integration registration (missing HERMES_API_URL, DOMAIN_INTEGRATION_REGISTRATION_API_KEY, or MEDIAPULSE_API_URL)",
    );
    return;
  }

  const requestBody = registerDomainIntegrationRequestSchema.parse({
    key: env.DOMAIN_INTEGRATION_KEY ?? "mediapulse",
    name: env.DOMAIN_INTEGRATION_NAME ?? "Mediapulse",
    baseUrl: env.MEDIAPULSE_API_URL,
    version: env.DOMAIN_INTEGRATION_VERSION,
    capabilities: ["expand-step-inputs", "preview-expansion"],
    dashboard: dashboardManifest,
  });

  for (let attempt = 1; attempt <= REGISTRATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `${env.HERMES_API_URL.replace(/\/$/, "")}/api/domain-integrations/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.DOMAIN_INTEGRATION_REGISTRATION_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (response.ok) {
        logger.info({ attempt }, "Domain integration registered successfully");
        return;
      }

      const body = z
        .unknown()
        .catch(undefined)
        .parse(await response.json().catch(() => undefined));
      const retryable = shouldRetryStatus(response.status);
      if (!retryable || attempt === REGISTRATION_MAX_ATTEMPTS) {
        logger.error(
          { status: response.status, body, attempt },
          "Domain integration registration failed",
        );
        return;
      }

      const delayMs = getBackoffDelayMs(attempt);
      logger.warn(
        { status: response.status, body, attempt, delayMs },
        "Domain integration registration failed; retrying",
      );
      await sleep(delayMs);
    } catch (error) {
      if (attempt === REGISTRATION_MAX_ATTEMPTS) {
        logger.error(
          { attempt, error },
          "Domain integration registration failed with network error",
        );
        return;
      }

      const delayMs = getBackoffDelayMs(attempt);
      logger.warn(
        { attempt, delayMs, error },
        "Domain integration registration failed; retrying",
      );
      await sleep(delayMs);
    }
  }
};

void registerWithHermes();

export default {
  port: env.PORT ?? 8090,
  fetch: api.fetch,
};

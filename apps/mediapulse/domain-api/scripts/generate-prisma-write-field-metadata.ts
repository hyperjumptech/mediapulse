/**
 * Reads Mediapulse Prisma `schema.prisma` via Prisma schema WASM `get_dmmf` and emits scalar/enum field metadata for dashboard write-body Zod builders.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  dmmfFieldToWriteMeta,
  formatPrismaWriteFieldMetadataModule,
  PRISMA_WRITE_METADATA_MODEL_NAMES,
  type FieldMeta,
  type PrismaWriteMetadataModelName,
} from "../src/lib/prisma-write-schema/prisma-write-metadata-codegen-helpers";
import { getDmmfJsonFromPrismaSchema } from "../src/lib/prisma-write-schema/get-dmmf-json-from-prisma-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schemaPath = path.resolve(
  __dirname,
  "../../../../packages/mediapulse/database/prisma/schema.prisma",
);

const outputPath = path.resolve(
  __dirname,
  "../src/generated/prisma-write-field-metadata.ts",
);

const main = (): void => {
  const prismaSchema = readFileSync(schemaPath, "utf8");
  const dmmf = JSON.parse(getDmmfJsonFromPrismaSchema(prismaSchema)) as {
    datamodel: {
      models: Array<{
        name: string;
        fields: Array<{
          kind: string;
          name: string;
          type: string;
          isRequired: boolean;
          isList: boolean;
        }>;
      }>;
    };
  };

  const models = {} as Record<
    PrismaWriteMetadataModelName,
    Record<string, FieldMeta>
  >;

  // Only models in PRISMA_WRITE_METADATA_MODEL_NAMES (allowlist) — not every DMMF model.
  for (const modelName of PRISMA_WRITE_METADATA_MODEL_NAMES) {
    const model = dmmf.datamodel.models.find((m) => m.name === modelName);
    if (!model) {
      throw new Error(`Prisma model not found in DMMF: ${modelName}`);
    }
    const fields: Record<string, FieldMeta> = {};
    for (const field of model.fields) {
      const meta = dmmfFieldToWriteMeta(field);
      if (meta) {
        fields[field.name] = meta;
      }
    }
    models[modelName] = fields;
  }

  const contents = formatPrismaWriteFieldMetadataModule(models);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${contents}\n`, "utf8");
  // eslint-disable-next-line no-console -- generator CLI
  console.log(`Wrote ${outputPath}`);
};

main();

/**
 * Loads Prisma DMMF JSON from a `schema.prisma` string via `@prisma/prisma-schema-wasm` (Prisma 7 — URL in `prisma.config.ts`).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Prisma WASM expects this global before schema helpers run (see prisma/issues panic registry). */
const ensurePrismaWasmPanicRegistry = (): void => {
  const g = globalThis as typeof globalThis & {
    PRISMA_WASM_PANIC_REGISTRY?: { set_message: (msg: string) => void };
  };
  if (!g.PRISMA_WASM_PANIC_REGISTRY) {
    g.PRISMA_WASM_PANIC_REGISTRY = {
      set_message: () => {
        /* wasm forwards panic text here when debugging */
      },
    };
  }
};

/**
 * Returns DMMF JSON string from a Prisma 7 schema file body (`prismaSchema` param to wasm).
 *
 * @param prismaSchema - Full `schema.prisma` source (no `url` in datasource block).
 * @returns Serialized DMMF from `get_dmmf`.
 */
export const getDmmfJsonFromPrismaSchema = (prismaSchema: string): string => {
  ensurePrismaWasmPanicRegistry();
  const wasm = require("@prisma/prisma-schema-wasm") as {
    validate: (params: string) => void;
    get_dmmf: (params: string) => string;
  };
  const params = JSON.stringify({ prismaSchema });
  wasm.validate(params);
  return wasm.get_dmmf(params);
};

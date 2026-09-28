import { readFileSync, writeFileSync } from "node:fs";

const ZOD_V3_COERCED_NUMBER = "z.number({ coerce: true })";

const ZOD_V4_COERCED_NUMBER = "z.coerce.number()";

export const normalizeGeneratedEnvSource = (source: string): string =>
  source.replaceAll(ZOD_V3_COERCED_NUMBER, ZOD_V4_COERCED_NUMBER);

export const normalizeGeneratedEnvFile = (filePath: string): void => {
  const source = readFileSync(filePath, "utf8");
  const normalized = normalizeGeneratedEnvSource(source);
  if (normalized !== source) {
    writeFileSync(filePath, normalized);
  }
};

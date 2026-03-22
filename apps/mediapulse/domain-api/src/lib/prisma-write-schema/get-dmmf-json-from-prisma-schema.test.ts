/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { getDmmfJsonFromPrismaSchema } from "./get-dmmf-json-from-prisma-schema";

const minimalPrismaSchema = `
generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "postgresql"
}

model Demo {
  id    String  @id
  title String
  count Int?
}
`;

describe("getDmmfJsonFromPrismaSchema", () => {
  it("returns parseable DMMF with expected model", () => {
    // Act
    const json = getDmmfJsonFromPrismaSchema(minimalPrismaSchema);
    const dmmf = JSON.parse(json) as {
      datamodel: { models: Array<{ name: string }> };
    };

    // Assert
    expect(dmmf.datamodel.models.some((m) => m.name === "Demo")).toBe(true);
  });
});

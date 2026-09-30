import { describe, expect, it } from "vitest";

import { readRouteConfigContract } from "./route-config-body-keys.js";

const routeConfig = (body: string): string => `
import { createRequestValidator } from "route-action-gen/lib";
import { z } from "zod";

${body}

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});
`;

describe("readRouteConfigContract", () => {
  it("reads body keys, their optionality, and the user guard", () => {
    const source = routeConfig(`
const bodyValidator = z.object({
  id: z.guid(),
  name: z.string().min(1).optional(),
  enabled: z.union([z.boolean(), z.literal("true")]).default(true).transform((v) => v === true),
});`);

    const contract = readRouteConfigContract("route.post.config.ts", source);

    expect(contract.userGuard).toBe(
      "requireMutationDashboardPrincipalForRoute",
    );
    expect(contract.bodyKeys).toEqual([
      { name: "id", optional: false },
      { name: "name", optional: true },
      { name: "enabled", optional: true },
    ]);
  });

  it("follows local constants, spreads, and refinements", () => {
    const source = routeConfig(`
const jsonObjectSchema = z.union([z.record(z.string(), z.unknown()), z.string()]).optional();
const sharedShape = { note: z.string().nullish() };
const bodyValidator = z
  .object({ input: jsonObjectSchema, ...sharedShape })
  .superRefine(() => undefined);`);

    const contract = readRouteConfigContract("route.post.config.ts", source);

    expect(contract.bodyKeys).toEqual([
      { name: "input", optional: true },
      { name: "note", optional: true },
    ]);
  });

  it("knows the shared JSON object field helpers", () => {
    const source = routeConfig(`
const bodyValidator = z.object({
  endpoint: jsonObjectFieldSchema("Endpoint"),
  patch: optionalJsonObjectFieldSchema("Patch"),
});`);

    const contract = readRouteConfigContract("route.post.config.ts", source);

    expect(contract.bodyKeys).toEqual([
      { name: "endpoint", optional: false },
      { name: "patch", optional: true },
    ]);
  });

  it("fails loudly on a schema it cannot resolve", () => {
    const source = routeConfig(`
const bodyValidator = z.object({ value: importedHelper() });`);

    expect(() =>
      readRouteConfigContract("route.post.config.ts", source),
    ).toThrow("Extend route-config-body-keys.ts");
  });
});

/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/pipeline-usage", () => ({
  getPipelinesUsingVariableKey: vi.fn(),
  getPipelinesUsingExpansionString: vi.fn(),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: vi.fn(),
}));

import { GET } from "./route";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  getPipelinesUsingExpansionString,
  getPipelinesUsingVariableKey,
} from "@/lib/pipeline-usage";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = (query: string) =>
  GET(new Request(`http://localhost/api/pipeline-usage${query}`));

describe("GET /api/pipeline-usage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists pipelines that use a variable key", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getPipelinesUsingVariableKey).mockResolvedValue([
      { pipelineId: "p1", pipelineName: "Collect" },
    ] as never);

    const response = await callRoute("?variableKey=API_KEY");

    expect(getPipelinesUsingVariableKey).toHaveBeenCalledWith("API_KEY");
    expect(await response.json()).toEqual({
      pipelines: [{ pipelineId: "p1", pipelineName: "Collect" }],
    });
  });

  it("resolves the integration before looking up an expansion", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getDomainIntegrationByIntegrationId).mockResolvedValue({
      id: "integration-row-id",
    } as never);
    vi.mocked(getPipelinesUsingExpansionString).mockResolvedValue([]);

    await callRoute("?integrationId=acme&expansionString=db%3Aitem%3Aid");

    expect(getPipelinesUsingExpansionString).toHaveBeenCalledWith(
      "integration-row-id",
      "db:item:id",
    );
  });

  it("rejects a query with neither lookup", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );

    const response = await callRoute("?integrationId=acme");

    expect(response.status).toBe(400);
  });
});

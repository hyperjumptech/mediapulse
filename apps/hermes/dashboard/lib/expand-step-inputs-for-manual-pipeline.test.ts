/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const expandStepInputsHttp = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    expandedInputs: [{ id: "a" }, { id: "b" }],
  }),
);

vi.mock("@hermes/domain-contract", () => ({
  createDomainIntegrationClient: vi.fn(() => ({
    expandStepInputs: expandStepInputsHttp,
  })),
}));

vi.mock("./domain-integration-auth-token", () => ({
  getBearerJwtForDomainIntegrationId: vi.fn().mockResolvedValue("jwt"),
}));

describe("createExpandStepInputsForManualPipelineRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when domain integration has no base URL", async () => {
    const { createExpandStepInputsForManualPipelineRun } =
      await import("./expand-step-inputs-for-manual-pipeline");
    const expand = createExpandStepInputsForManualPipelineRun();
    await expect(
      expand({
        input: {},
        scheduleId: "s",
        pipelineId: "p",
        pipelineStepId: "st",
        domainIntegrationId: "di-1",
        orchDb: {
          domainIntegration: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          dataSourceExpansionTemplate: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        } as never,
      }),
    ).rejects.toThrow(/no base URL/);
  });

  it("returns expanded inputs from domain-api", async () => {
    const { createExpandStepInputsForManualPipelineRun } =
      await import("./expand-step-inputs-for-manual-pipeline");
    const expand = createExpandStepInputsForManualPipelineRun();
    const result = await expand({
      input: { tickerId: "{{dse:tpl-1}}" },
      scheduleId: "s",
      pipelineId: "p",
      pipelineStepId: "st",
      domainIntegrationId: "di-1",
      orchDb: {
        domainIntegration: {
          findFirst: vi.fn().mockResolvedValue({
            baseUrl: "https://domain.example",
          }),
        },
        dataSourceExpansionTemplate: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: "tpl-1", expansionString: "db:ticker:id" },
            ]),
        },
      } as never,
    });
    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    expect(expandStepInputsHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { tickerId: "db:ticker:id" },
      }),
    );
  });

  it("throws when referenced template id does not exist", async () => {
    const { createExpandStepInputsForManualPipelineRun } =
      await import("./expand-step-inputs-for-manual-pipeline");
    const expand = createExpandStepInputsForManualPipelineRun();

    await expect(
      expand({
        input: { tickerId: "{{dse:missing}}" },
        scheduleId: "s",
        pipelineId: "p",
        pipelineStepId: "st",
        domainIntegrationId: "di-1",
        orchDb: {
          domainIntegration: {
            findFirst: vi.fn().mockResolvedValue({
              baseUrl: "https://domain.example",
            }),
          },
          dataSourceExpansionTemplate: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        } as never,
      }),
    ).rejects.toThrow(/template not found/i);
  });
});

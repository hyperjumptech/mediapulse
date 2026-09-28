import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHttpTriggerByIdMock = vi.fn();
const getHttpTriggerExecutionsPageMock = vi.fn().mockResolvedValue({
  executions: [],
  total: 0,
  page: 1,
  pageSize: 15,
});
const getPipelinesWithStepsMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerById: (...args: unknown[]) => getHttpTriggerByIdMock(...args),
  getHttpTriggerExecutionsPage: (...args: unknown[]) =>
    getHttpTriggerExecutionsPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("./http-trigger-executions-section", () => ({
  HttpTriggerExecutionsSection: ({
    triggerId,
    page,
    pageSize,
  }: {
    triggerId: string;
    page: number;
    pageSize: number;
  }) => (
    <div
      data-testid="http-trigger-executions-section"
      data-trigger-id={triggerId}
      data-page={page}
      data-page-size={pageSize}
    />
  ),
}));

vi.mock("./http-trigger-detail-content", () => ({
  HttpTriggerDetailContent: ({
    trigger,
    executionsSection,
    pipelines,
  }: {
    trigger: { id: string; name: string };
    executionsSection: React.ReactNode;
    pipelines: unknown[];
  }) => (
    <div
      data-testid="http-trigger-detail-content"
      data-trigger-name={trigger.name}
      data-pipelines-count={pipelines.length}
    >
      HTTP Trigger Detail
      {executionsSection}
    </div>
  ),
}));

import HttpTriggerDetailPage from "./page";

describe("HttpTriggerDetailPage", () => {
  afterEach(() => {
    getHttpTriggerByIdMock.mockReset();
    getPipelinesWithStepsMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders trigger detail content with the executions section", async () => {
    // Setup
    getHttpTriggerByIdMock.mockResolvedValue({
      id: "trigger-1",
      name: "Webhook",
      pipeline: { id: "p1", name: "Pipeline" },
    });
    getPipelinesWithStepsMock.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    // Act
    const component = await HttpTriggerDetailPage({
      params: Promise.resolve({ id: "trigger-1" }),
      searchParams: Promise.resolve({ page: "2", size: "10" }),
    });
    render(component);

    // Assert
    const content = screen.getByTestId("http-trigger-detail-content");
    const executionsSection = screen.getByTestId(
      "http-trigger-executions-section",
    );

    expect(getHttpTriggerByIdMock).toHaveBeenCalledWith("trigger-1");
    expect(content).toHaveAttribute("data-trigger-name", "Webhook");
    expect(content).toHaveAttribute("data-pipelines-count", "2");
    expect(executionsSection).toHaveAttribute("data-trigger-id", "trigger-1");
    expect(executionsSection).toHaveAttribute("data-page", "2");
    expect(executionsSection).toHaveAttribute("data-page-size", "10");
  });

  it("calls notFound when the trigger does not exist", async () => {
    // Setup
    getHttpTriggerByIdMock.mockResolvedValue(null);
    getPipelinesWithStepsMock.mockResolvedValue([]);
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    // Act
    await expect(
      HttpTriggerDetailPage({
        params: Promise.resolve({ id: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
  });
});

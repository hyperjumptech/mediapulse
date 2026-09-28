import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpTriggerDetailContent } from "./http-trigger-detail-content";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("../http-trigger-form-modal", () => ({
  HttpTriggerFormModal: ({
    open,
    mode,
    editHttpTriggerId,
  }: {
    open: boolean;
    mode: string;
    editHttpTriggerId: string | null;
  }) => (
    <div
      data-testid="http-trigger-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editHttpTriggerId ?? "none"}
    />
  ),
}));

type HttpTriggerDetailContentProps = React.ComponentProps<
  typeof HttpTriggerDetailContent
>;
type TriggerRow = HttpTriggerDetailContentProps["trigger"];

const createMockTrigger = (overrides?: Partial<TriggerRow>): TriggerRow => ({
  id: "trigger-1",
  name: "Inbound webhook",
  description: "Called by the CMS on publish",
  pipelineId: "p1",
  enabled: true,
  method: "POST",
  authType: "BEARER_TOKEN",
  tokenHint: "...wxyz",
  createdAt: new Date("2026-09-25T12:00:00Z"),
  updatedAt: new Date("2026-09-25T12:00:00Z"),
  lastTriggeredAt: new Date("2026-09-28T11:30:00Z"),
  createdById: "u1",
  createdBy: { id: "u1", name: "Kevin", email: "kevin@example.com" },
  pipeline: {
    id: "p1",
    name: "Main",
    description: null,
    timeout: null,
    isActive: true,
    executionConfig: null,
    domainIntegrationId: "00000000-0000-4000-8000-000000000001",
    createdById: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  ...overrides,
});

const renderTriggerDetail = (trigger: TriggerRow) =>
  render(
    <HttpTriggerDetailContent
      trigger={trigger}
      executionsSection={<div data-testid="executions-section" />}
      pipelines={[]}
    />,
  );

const summaryValue = (label: string) => {
  const term = screen.getByText(label, { selector: "dt" });

  return term.nextElementSibling as HTMLElement;
};

describe("HttpTriggerDetailContent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    writeTextMock.mockReset();
  });

  it("renders the name, status and description without a back link", () => {
    // Act
    renderTriggerDetail(createMockTrigger());

    // Assert
    expect(screen.getByText("enabled")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(
      screen.getByText("Called by the CMS on publish"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /back to http triggers/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a disabled status and no description when absent", () => {
    // Act
    renderTriggerDetail(
      createMockTrigger({ enabled: false, description: null }),
    );

    // Assert
    expect(screen.getByText("disabled")).toHaveAttribute(
      "data-variant",
      "muted",
    );
    expect(
      screen.queryByText("Called by the CMS on publish"),
    ).not.toBeInTheDocument();
  });

  it("summarizes the pipeline, method, auth and token hint", () => {
    // Act
    renderTriggerDetail(createMockTrigger());

    // Assert
    expect(
      within(summaryValue("Pipeline")).getByRole("link", { name: "Main" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/p1");
    expect(within(summaryValue("Method")).getByText("POST")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(summaryValue("Auth")).toHaveTextContent("Bearer token");
    expect(
      within(summaryValue("Token hint")).getByText("...wxyz").tagName,
    ).toBe("CODE");
  });

  it("humanizes unknown auth types and handles a missing token hint", () => {
    // Act
    renderTriggerDetail(
      createMockTrigger({
        authType: "SIGNED_REQUEST" as TriggerRow["authType"],
        tokenHint: null,
      }),
    );

    // Assert
    expect(summaryValue("Auth")).toHaveTextContent("signed request");
    expect(summaryValue("Token hint")).toHaveTextContent("Not recorded");
  });

  it("shows the full invoke URL with a copy button", () => {
    // Act
    renderTriggerDetail(createMockTrigger());

    // Assert
    const invokeUrl = summaryValue("Invoke URL");

    expect(invokeUrl).toHaveTextContent(
      `${window.location.origin}/api/http-triggers/trigger-1/invoke`,
    );
    expect(
      within(invokeUrl).getByRole("button", { name: "Copy invoke URL" }),
    ).toBeInTheDocument();
  });

  it("shows when the trigger last fired and who created it", () => {
    // Act
    renderTriggerDetail(createMockTrigger());

    // Assert
    expect(summaryValue("Last triggered")).toHaveTextContent(
      "Sep 28, 2026, 11:30 30m ago",
    );
    expect(summaryValue("Created")).toHaveTextContent("Sep 25, 2026, 12:00");
    expect(summaryValue("Created by")).toHaveTextContent("Kevin");
  });

  it("shows Never when the trigger has not fired", () => {
    // Act
    renderTriggerDetail(createMockTrigger({ lastTriggeredAt: null }));

    // Assert
    expect(summaryValue("Last triggered")).toHaveTextContent("Never");
  });

  it("copies the cURL command and confirms with a toast", async () => {
    // Setup
    writeTextMock.mockResolvedValue(undefined);
    renderTriggerDetail(createMockTrigger());

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Copy cURL" }));

    // Assert
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("cURL command copied");
    });
    expect(writeTextMock).toHaveBeenCalledWith(
      `curl -X POST "${window.location.origin}/api/http-triggers/trigger-1/invoke" -H "Authorization: Bearer <YOUR_TRIGGER_TOKEN>"`,
    );
  });

  it("reports a failed cURL copy with an error toast", async () => {
    // Setup
    writeTextMock.mockRejectedValue(new Error("denied"));
    renderTriggerDetail(createMockTrigger());

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Copy cURL" }));

    // Assert
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Couldn't copy the cURL command",
      );
    });
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("opens the edit modal from the header", () => {
    // Setup
    renderTriggerDetail(createMockTrigger());
    const modal = screen.getByTestId("http-trigger-form-modal");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit HTTP trigger" }));

    // Assert
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "trigger-1");
  });

  it("renders the executions section under the Executions heading", () => {
    // Act
    renderTriggerDetail(createMockTrigger());

    // Assert
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Executions",
    });
    const section = heading.closest("section") as HTMLElement;

    expect(
      within(section).getByTestId("executions-section"),
    ).toBeInTheDocument();
  });
});

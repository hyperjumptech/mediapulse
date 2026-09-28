import React from "react";
import { render, screen } from "@testing-library/react";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getDomainIntegrationByIntegrationIdMock = vi.fn();
const getDomainTableMetaMock = vi.fn();
const getDomainTableItemByIdMock = vi.fn();
const submitDomainTableFullPageUpdateMock = vi.fn();
const editorMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationIdMock(...args),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableMeta: (...args: unknown[]) => getDomainTableMetaMock(...args),
  getDomainTableItemById: (...args: unknown[]) =>
    getDomainTableItemByIdMock(...args),
}));

vi.mock("@/lib/data-source-expansion-templates", () => ({
  getDataSourceExpansionTemplateByIdWithUsageForIntegration: vi.fn(),
}));

vi.mock("@/lib/domain-table-full-page-actions", () => ({
  submitDomainTableFullPageUpdate: (...args: unknown[]) =>
    submitDomainTableFullPageUpdateMock(...args),
}));

vi.mock("@/components/domain-table-full-page-editor", () => ({
  DomainTableFullPageEditor: (props: { title: string }) => {
    editorMock(props);

    return <div data-testid="full-page-editor">{props.title}</div>;
  },
}));

import EditDomainTablePage from "./page";

type FormAction = (formData: FormData) => Promise<void>;

const admin = {
  id: "u1",
  name: "U",
  email: "u@example.com",
  credentialVersion: 0,
};

const renderPage = async () => {
  render(
    await EditDomainTablePage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "tickers",
        itemId: "t-1",
      }),
    }),
  );
};

const submitForm = () => {
  const { formAction } = editorMock.mock.lastCall?.[0] as {
    formAction: FormAction;
  };
  const formData = new FormData();
  formData.set("__id", "t-1");
  formData.set("symbol", "ACME");

  return formAction(formData);
};

describe("EditDomainTablePage", () => {
  beforeEach(() => {
    requireDashboardAdminMock.mockResolvedValue(admin);
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      integrationId: "mediapulse",
      capabilities: [],
    });
    getDomainTableMetaMock.mockResolvedValue(
      tableV1MetaResponseSchema.parse({
        title: "Tickers",
        columns: [{ key: "symbol", label: "Symbol" }],
        actions: { update: true },
        createNavigation: "full-page",
        updateSchema: {
          type: "object",
          properties: { symbol: { type: "string" } },
        },
      }),
    );
    getDomainTableItemByIdMock.mockResolvedValue({ id: "t-1", symbol: "OLD" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    requireDashboardAdminMock.mockReset();
  });

  it("renders the full-page edit editor with the loaded row", async () => {
    // Act
    await renderPage();

    // Assert
    expect(screen.getByTestId("full-page-editor")).toHaveTextContent(
      "Edit Tickers",
    );
    expect(getDomainTableItemByIdMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
    );
    expect(editorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "edit",
        rowId: "t-1",
        defaultRow: { id: "t-1", symbol: "OLD" },
      }),
    );
  });

  it("submits the update payload for an admin", async () => {
    // Setup
    await renderPage();

    // Act
    await submitForm();

    // Assert
    expect(submitDomainTableFullPageUpdateMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
      "/dashboard/mediapulse/tickers",
      { symbol: "ACME" },
    );
  });

  it("rejects the update action for callers who are not active admins", async () => {
    // Setup
    await renderPage();
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = submitForm();

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(submitDomainTableFullPageUpdateMock).not.toHaveBeenCalled();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getDomainIntegrationByIntegrationIdMock = vi.fn();
const getDomainTableMetaMock = vi.fn();
const submitDomainTableFullPageCreateMock = vi.fn();
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
}));

vi.mock("@/lib/domain-table-full-page-actions", () => ({
  submitDomainTableFullPageCreate: (...args: unknown[]) =>
    submitDomainTableFullPageCreateMock(...args),
}));

vi.mock("@/components/domain-table-full-page-editor", () => ({
  DomainTableFullPageEditor: (props: object) => {
    editorMock(props);

    return <div data-testid="full-page-editor" />;
  },
}));

import NewDomainTablePage from "./page";

type FormAction = (formData: FormData) => Promise<void>;

const admin = {
  id: "u1",
  name: "U",
  email: "u@example.com",
  credentialVersion: 0,
};

const renderPage = async () => {
  render(
    await NewDomainTablePage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "tickers",
      }),
    }),
  );
};

const submitForm = () => {
  const { formAction } = editorMock.mock.lastCall?.[0] as {
    formAction: FormAction;
  };
  const formData = new FormData();
  formData.set("symbol", "ACME");

  return formAction(formData);
};

describe("NewDomainTablePage", () => {
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
        actions: { create: true },
        createNavigation: "full-page",
        createSchema: {
          type: "object",
          properties: { symbol: { type: "string" } },
        },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    requireDashboardAdminMock.mockReset();
  });

  it("renders the full-page create editor", async () => {
    // Act
    await renderPage();

    // Assert
    expect(screen.getByTestId("full-page-editor")).toBeInTheDocument();
    expect(editorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "create",
        basePath: "/dashboard/mediapulse/tickers",
        integrationId: "mediapulse",
      }),
    );
  });

  it("submits the create payload for an admin", async () => {
    // Setup
    await renderPage();

    // Act
    await submitForm();

    // Assert
    expect(submitDomainTableFullPageCreateMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "/dashboard/mediapulse/tickers",
      { symbol: "ACME" },
    );
  });

  it("rejects the create action for callers who are not active admins", async () => {
    // Setup
    await renderPage();
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = submitForm();

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
    expect(submitDomainTableFullPageCreateMock).not.toHaveBeenCalled();
  });
});

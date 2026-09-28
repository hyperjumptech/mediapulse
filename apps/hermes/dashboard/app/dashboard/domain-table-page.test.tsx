import React from "react";
import { render, screen } from "@testing-library/react";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const getDomainTableMetaMock = vi.fn();
const createDomainTableItemMock = vi.fn();
const updateDomainTableItemMock = vi.fn();
const deleteDomainTableItemMock = vi.fn();
const invokeDomainTableCustomActionMock = vi.fn();
const invokeDomainTableDangerConfirmActionMock = vi.fn();
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();
const rowsSectionMock = vi.fn();
const createModalMock = vi.fn();
const jsonUploadCardMock = vi.fn();
const dangerConfirmButtonMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableMeta: (...args: unknown[]) => getDomainTableMetaMock(...args),
  createDomainTableItem: (...args: unknown[]) =>
    createDomainTableItemMock(...args),
  updateDomainTableItem: (...args: unknown[]) =>
    updateDomainTableItemMock(...args),
  deleteDomainTableItem: (...args: unknown[]) =>
    deleteDomainTableItemMock(...args),
  invokeDomainTableCustomAction: (...args: unknown[]) =>
    invokeDomainTableCustomActionMock(...args),
  invokeDomainTableDangerConfirmAction: (...args: unknown[]) =>
    invokeDomainTableDangerConfirmActionMock(...args),
}));

vi.mock("@/app/dashboard/domain-table-rows-section", () => ({
  DomainTableRowsSection: (props: unknown) => {
    rowsSectionMock(props);

    return <div data-testid="domain-table-rows-section" />;
  },
}));

vi.mock("@/app/dashboard/domain-create-modal", () => ({
  DomainCreateModal: (props: unknown) => {
    createModalMock(props);

    return <div data-testid="domain-create-modal" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-json-upload-card", () => ({
  DomainTableJsonUploadCard: (props: unknown) => {
    jsonUploadCardMock(props);

    return <div data-testid="domain-table-json-upload-card" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-danger-confirm-button", () => ({
  DomainTableDangerConfirmButton: (props: unknown) => {
    dangerConfirmButtonMock(props);

    return <div data-testid="domain-table-danger-confirm-button" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-search", () => ({
  DomainTableSearch: () => <div data-testid="domain-table-search" />,
}));

vi.mock("@/app/dashboard/domain-table-list-filters", () => ({
  DomainTableListFilters: () => <div data-testid="domain-table-list-filters" />,
}));

import { DomainTablePage } from "./domain-table-page";

type FormAction = (formData: FormData) => Promise<void>;

type StateAction = (state: unknown, formData: FormData) => Promise<unknown>;

const admin = {
  id: "u1",
  name: "U",
  email: "u@example.com",
  credentialVersion: 0,
};

const meta = tableV1MetaResponseSchema.parse({
  title: "Tickers",
  columns: [{ key: "symbol", label: "Symbol" }],
  actions: { create: true, update: true, delete: true },
  createSchema: {
    type: "object",
    properties: { symbol: { type: "string" } },
  },
  updateSchema: {
    type: "object",
    properties: { symbol: { type: "string" } },
  },
  customActions: [
    {
      id: "import",
      label: "Import",
      ui: "json-file-upload",
      method: "POST",
      path: "/import",
    },
    {
      id: "reset",
      label: "Reset",
      ui: "danger-confirm",
      method: "POST",
      path: "/reset",
    },
  ],
});

const lastProps = <Props,>(mock: ReturnType<typeof vi.fn>): Props =>
  mock.mock.lastCall?.[0] as Props;

const buildFormData = (entries: Record<string, string>) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
};

const renderPage = async () => {
  render(
    await DomainTablePage({
      integrationId: "mediapulse",
      resource: "tickers",
      searchParams: { q: "acme", page: "2" },
    }),
  );
};

describe("DomainTablePage", () => {
  beforeEach(() => {
    requireDashboardAdminMock.mockResolvedValue(admin);
    getDomainTableMetaMock.mockResolvedValue(meta);
  });

  afterEach(() => {
    vi.clearAllMocks();
    requireDashboardAdminMock.mockReset();
    getDomainTableMetaMock.mockReset();
  });

  it("renders the header and hands the rows section the parsed list params", async () => {
    // Act
    await renderPage();

    // Assert
    const rowsSectionProps =
      lastProps<Record<string, unknown>>(rowsSectionMock);

    expect(getDomainTableMetaMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
    );
    expect(
      screen.getByRole("heading", { name: "Tickers" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("domain-table-rows-section")).toBeInTheDocument();
    expect(rowsSectionProps).toMatchObject({
      integrationId: "mediapulse",
      resource: "tickers",
      basePath: "/dashboard/mediapulse/tickers",
      meta,
      params: { page: 2, pageSize: 15, query: "acme", filters: {} },
    });
    expect(rowsSectionProps.updateAction).toBeTypeOf("function");
    expect(rowsSectionProps.deleteAction).toBeTypeOf("function");
  });

  it("places custom danger actions and create in the page header", async () => {
    // Act
    await renderPage();

    // Assert
    const headerActions = document.querySelector(
      '[data-slot="page-header-actions"]',
    );

    expect(headerActions).toContainElement(
      screen.getByTestId("domain-table-danger-confirm-button"),
    );
    expect(headerActions).toContainElement(
      screen.getByTestId("domain-create-modal"),
    );
    expect(lastProps<{ triggerLabel: string }>(createModalMock)).toMatchObject({
      triggerLabel: "Add Tickers",
    });
    expect(headerActions).not.toContainElement(
      screen.getByTestId("domain-table-search"),
    );
  });

  it("links create to the full-page editor when the manifest asks for it", async () => {
    // Setup
    getDomainTableMetaMock.mockResolvedValue({
      ...meta,
      createNavigation: "full-page",
      customActions: [],
    });

    // Act
    await renderPage();

    // Assert
    expect(screen.getByRole("link", { name: "Add Tickers" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers/new",
    );
    expect(createModalMock).not.toHaveBeenCalled();
    expect(dangerConfirmButtonMock).not.toHaveBeenCalled();
  });

  it("omits header actions when the manifest allows no create or danger actions", async () => {
    // Setup
    getDomainTableMetaMock.mockResolvedValue({
      ...meta,
      actions: { create: false, update: false, delete: false },
      customActions: [],
    });

    // Act
    await renderPage();

    // Assert
    expect(
      document.querySelector('[data-slot="page-header-actions"]'),
    ).toBeNull();
    expect(screen.getByTestId("domain-table-search")).toBeInTheDocument();
  });

  it("creates an item for an admin and returns to the list", async () => {
    // Setup
    await renderPage();
    const { createAction } = lastProps<{ createAction: FormAction }>(
      createModalMock,
    );

    // Act
    await createAction(buildFormData({ symbol: "ACME" }));

    // Assert
    expect(createDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      { symbol: "ACME" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/mediapulse/tickers",
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/mediapulse/tickers");
  });

  it("updates an item for an admin without redirecting", async () => {
    // Setup
    await renderPage();
    const { updateAction } = lastProps<{ updateAction: FormAction }>(
      rowsSectionMock,
    );

    // Act
    await updateAction(buildFormData({ __id: "t-1", symbol: "ACME" }));

    // Assert
    expect(updateDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
      { symbol: "ACME" },
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  const unauthorizedCases = [
    {
      name: "createAction",
      invoke: () =>
        lastProps<{ createAction: FormAction }>(createModalMock).createAction(
          buildFormData({ symbol: "ACME" }),
        ),
      mutation: createDomainTableItemMock,
    },
    {
      name: "updateAction",
      invoke: () =>
        lastProps<{ updateAction: FormAction }>(rowsSectionMock).updateAction(
          buildFormData({ __id: "t-1", symbol: "ACME" }),
        ),
      mutation: updateDomainTableItemMock,
    },
    {
      name: "deleteAction",
      invoke: () =>
        lastProps<{ deleteAction: FormAction }>(rowsSectionMock).deleteAction(
          buildFormData({ __id: "t-1" }),
        ),
      mutation: deleteDomainTableItemMock,
    },
    {
      name: "jsonImportServerAction",
      invoke: () =>
        lastProps<{ serverAction: StateAction }>(
          jsonUploadCardMock,
        ).serverAction(
          { status: "idle" },
          buildFormData({ __actionId: "import", payloadJson: "[]" }),
        ),
      mutation: invokeDomainTableCustomActionMock,
    },
    {
      name: "dangerConfirmServerAction",
      invoke: () =>
        lastProps<{ serverAction: StateAction }>(
          dangerConfirmButtonMock,
        ).serverAction(
          { status: "idle" },
          buildFormData({ __actionId: "reset" }),
        ),
      mutation: invokeDomainTableDangerConfirmActionMock,
    },
  ];

  it.each(unauthorizedCases)(
    "$name rejects callers who are not active admins",
    async ({ invoke, mutation }) => {
      // Setup
      await renderPage();
      requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

      // Act
      const pending = invoke();

      // Assert
      await expect(pending).rejects.toThrow("NEXT_REDIRECT");
      expect(mutation).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    },
  );
});

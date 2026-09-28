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
const tableSectionMock = vi.fn();
const createModalMock = vi.fn();
const jsonImportDialogMock = vi.fn();
const dangerConfirmButtonMock = vi.fn();
const listFiltersMock = vi.fn();

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

vi.mock("@/app/dashboard/domain-table-section", () => ({
  DomainTableSection: (props: {
    toolbarFilters?: React.ReactNode;
    toolbarActions?: React.ReactNode;
  }) => {
    tableSectionMock(props);

    return (
      <div data-testid="domain-table-section">
        <div data-testid="toolbar-filters">{props.toolbarFilters}</div>
        <div data-testid="toolbar-actions">{props.toolbarActions}</div>
      </div>
    );
  },
}));

vi.mock("@/app/dashboard/domain-create-modal", () => ({
  DomainCreateModal: (props: unknown) => {
    createModalMock(props);

    return <div data-testid="domain-create-modal" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-json-import-dialog", () => ({
  DomainTableJsonImportDialog: (props: unknown) => {
    jsonImportDialogMock(props);

    return <div data-testid="domain-table-json-import-dialog" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-danger-confirm-button", () => ({
  DomainTableDangerConfirmButton: (props: unknown) => {
    dangerConfirmButtonMock(props);

    return <div data-testid="domain-table-danger-confirm-button" />;
  },
}));

vi.mock("@/app/dashboard/domain-table-list-filters", () => ({
  DomainTableListFilters: (props: unknown) => {
    listFiltersMock(props);

    return <div data-testid="domain-table-list-filters" />;
  },
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
  sortableFields: ["symbol"],
  listFilters: [
    {
      key: "sector",
      label: "Sector",
      ui: "select",
      staticOptions: [{ value: "energy", label: "Energy" }],
    },
  ],
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

const renderPage = async (
  searchParams: Record<string, string> = { q: "acme", page: "2" },
) => {
  const { container } = render(
    await DomainTablePage({
      integrationId: "mediapulse",
      resource: "tickers",
      searchParams,
    }),
  );

  return container;
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

  it("hands the table section the parsed list params and row actions", async () => {
    await renderPage();

    const sectionProps = lastProps<Record<string, unknown>>(tableSectionMock);

    expect(getDomainTableMetaMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
    );
    expect(sectionProps).toMatchObject({
      integrationId: "mediapulse",
      resource: "tickers",
      basePath: "/dashboard/mediapulse/tickers",
      meta,
      params: { page: 2, pageSize: 15, query: "acme", filters: {} },
    });
    expect(sectionProps.updateAction).toBeTypeOf("function");
    expect(sectionProps.deleteAction).toBeTypeOf("function");
  });

  it("renders no page header above the table", async () => {
    const container = await renderPage();

    const page = container.firstElementChild as HTMLElement;

    expect(
      container.querySelector('[data-slot="page-header-actions"]'),
    ).toBeNull();
    expect(page.firstElementChild).toBe(
      screen.getByTestId("domain-table-section"),
    );
  });

  it("puts the JSON import and danger actions in the table toolbar", async () => {
    await renderPage();

    const toolbarActions = screen.getByTestId("toolbar-actions");

    expect(toolbarActions).toContainElement(
      screen.getByTestId("domain-table-json-import-dialog"),
    );
    expect(toolbarActions).toContainElement(
      screen.getByTestId("domain-table-danger-confirm-button"),
    );
    expect(
      lastProps<{ action: { id: string } }>(jsonImportDialogMock),
    ).toMatchObject({ action: { id: "import" } });
    expect(
      lastProps<{ action: { id: string } }>(dangerConfirmButtonMock),
    ).toMatchObject({ action: { id: "reset" } });
  });

  it("puts the manifest filters in the table toolbar with the other list params preserved", async () => {
    await renderPage({
      q: "acme",
      sort: "symbol",
      dir: "asc",
      sector: "energy",
    });

    expect(screen.getByTestId("toolbar-filters")).toContainElement(
      screen.getByTestId("domain-table-list-filters"),
    );
    expect(listFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: "/dashboard/mediapulse/tickers",
        filterValues: { sector: "energy" },
        preserveParams: { sort: "symbol", dir: "asc", q: "acme" },
      }),
    );
  });

  it("leaves the toolbar slots empty without filters or custom actions", async () => {
    getDomainTableMetaMock.mockResolvedValue({
      ...meta,
      listFilters: [],
      customActions: [],
    });

    await renderPage();

    const sectionProps = lastProps<Record<string, unknown>>(tableSectionMock);

    expect(sectionProps.toolbarFilters).toBeUndefined();
    expect(sectionProps.toolbarActions).toBeUndefined();
  });

  it("mounts the create dialog without a trigger of its own", async () => {
    await renderPage();

    expect(screen.getByTestId("domain-create-modal")).toBeInTheDocument();
    expect(createModalMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ triggerLabel: expect.anything() }),
    );
    expect(lastProps<{ title: string }>(createModalMock)).toMatchObject({
      title: "Add Tickers",
    });
    expect(screen.queryByRole("link", { name: /Add/ })).not.toBeInTheDocument();
  });

  it("skips the create dialog when the manifest creates on a full page", async () => {
    getDomainTableMetaMock.mockResolvedValue({
      ...meta,
      createNavigation: "full-page",
    });

    await renderPage();

    expect(createModalMock).not.toHaveBeenCalled();
  });

  it("skips the create dialog when the manifest cannot create", async () => {
    getDomainTableMetaMock.mockResolvedValue({
      ...meta,
      actions: { create: false, update: true, delete: true, view: false },
    });

    await renderPage();

    expect(createModalMock).not.toHaveBeenCalled();
  });

  it("creates an item for an admin and refreshes the list", async () => {
    await renderPage();
    const { createAction } = lastProps<{ createAction: FormAction }>(
      createModalMock,
    );

    await createAction(buildFormData({ symbol: "ACME" }));

    expect(createDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      { symbol: "ACME" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/mediapulse/tickers",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updates an item for an admin without redirecting", async () => {
    await renderPage();
    const { updateAction } = lastProps<{ updateAction: FormAction }>(
      tableSectionMock,
    );

    await updateAction(buildFormData({ __id: "t-1", symbol: "ACME" }));

    expect(updateDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
      { symbol: "ACME" },
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("deletes an item for an admin and returns to the list", async () => {
    await renderPage();
    const { deleteAction } = lastProps<{ deleteAction: FormAction }>(
      tableSectionMock,
    );

    await deleteAction(buildFormData({ __id: "t-1" }));

    expect(deleteDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/mediapulse/tickers");
  });

  it("reports how many rows a JSON import added and updated", async () => {
    await renderPage();
    invokeDomainTableCustomActionMock.mockResolvedValue({
      success: true,
      data: { added: 2, updated: 1 },
    });
    const { serverAction } = lastProps<{ serverAction: StateAction }>(
      jsonImportDialogMock,
    );

    const state = await serverAction(
      { status: "idle" },
      buildFormData({ __actionId: "import", payloadJson: "[]" }),
    );

    expect(state).toEqual({ status: "success", added: 2, updated: 1 });
    expect(invokeDomainTableCustomActionMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "import",
      "[]",
    );
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
        lastProps<{ updateAction: FormAction }>(tableSectionMock).updateAction(
          buildFormData({ __id: "t-1", symbol: "ACME" }),
        ),
      mutation: updateDomainTableItemMock,
    },
    {
      name: "deleteAction",
      invoke: () =>
        lastProps<{ deleteAction: FormAction }>(tableSectionMock).deleteAction(
          buildFormData({ __id: "t-1" }),
        ),
      mutation: deleteDomainTableItemMock,
    },
    {
      name: "jsonImportServerAction",
      invoke: () =>
        lastProps<{ serverAction: StateAction }>(
          jsonImportDialogMock,
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
      await renderPage();
      requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

      const pending = invoke();

      await expect(pending).rejects.toThrow("NEXT_REDIRECT");
      expect(mutation).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    },
  );
});

/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { DomainIntegrationTimeoutError } from "@/lib/domain-integration-request";
import { domainRequestFailedError } from "@/lib/domain-request-error";
import {
  createDomainRow,
  deleteDomainRow,
  runDomainTableCustomAction,
  updateDomainRow,
  type DomainRowMutationDependencies,
} from "@/lib/domain-table-row-mutations";

const target = { integrationId: "acme", resource: "orders" };

const meta = (overrides: Record<string, unknown> = {}) => ({
  title: "Orders",
  actions: { create: true, update: true, delete: false, view: true },
  customActions: [
    {
      id: "import",
      label: "Import",
      ui: "json-file-upload",
      method: "POST",
      path: "/import",
    },
    {
      id: "reset-all",
      label: "Reset all",
      ui: "danger-confirm",
      method: "POST",
      path: "/reset-all",
      confirmToken: "DELETE_ALL",
    },
  ],
  ...overrides,
});

const buildDependencies = (
  overrides: Partial<DomainRowMutationDependencies> = {},
): DomainRowMutationDependencies => ({
  getMeta: vi.fn().mockResolvedValue(meta()),
  createItem: vi.fn().mockResolvedValue({ id: "row-1" }),
  updateItem: vi.fn().mockResolvedValue({ id: "row-1" }),
  deleteItem: vi.fn().mockResolvedValue({ ok: true }),
  runJsonImport: vi
    .fn()
    .mockResolvedValue({ success: true, data: { added: 2, updated: 1 } }),
  runDangerConfirm: vi
    .fn()
    .mockResolvedValue({ success: true, data: { deleted: 7 } }),
  ...overrides,
});

describe("createDomainRow and updateDomainRow", () => {
  it("creates a row when the view allows it", async () => {
    const dependencies = buildDependencies();

    const result = await createDomainRow(
      { ...target, values: { reference: "A-1" } },
      dependencies,
    );

    expect(result).toEqual({ ok: true, data: { id: "row-1" } });
    expect(dependencies.createItem).toHaveBeenCalledWith("acme", "orders", {
      reference: "A-1",
    });
  });

  it("passes the row id through on update", async () => {
    const dependencies = buildDependencies();

    await updateDomainRow(
      { ...target, id: "row-1", values: { reference: "A-2" } },
      dependencies,
    );

    expect(dependencies.updateItem).toHaveBeenCalledWith(
      "acme",
      "orders",
      "row-1",
      { reference: "A-2" },
    );
  });

  it("keeps the domain's status and message when it rejects the row", async () => {
    const dependencies = buildDependencies({
      createItem: vi
        .fn()
        .mockRejectedValue(domainRequestFailedError(400, "reference is taken")),
    });

    const result = await createDomainRow(
      { ...target, values: {} },
      dependencies,
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "reference is taken",
    });
  });

  it("reports a domain timeout as 504", async () => {
    const dependencies = buildDependencies({
      createItem: vi
        .fn()
        .mockRejectedValue(
          new DomainIntegrationTimeoutError("acme", 30_000, undefined),
        ),
    });

    const result = await createDomainRow(
      { ...target, values: {} },
      dependencies,
    );

    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it("returns 404 when the view cannot be resolved", async () => {
    const dependencies = buildDependencies({
      getMeta: vi
        .fn()
        .mockRejectedValue(new Error('Unknown dashboard page "missing"')),
    });

    const result = await createDomainRow(
      { integrationId: "acme", resource: "missing", values: {} },
      dependencies,
    );

    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("deleteDomainRow", () => {
  it("refuses when the view does not allow deleting rows", async () => {
    const dependencies = buildDependencies();

    const result = await deleteDomainRow(
      { ...target, id: "row-1" },
      dependencies,
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(dependencies.deleteItem).not.toHaveBeenCalled();
  });
});

describe("runDomainTableCustomAction", () => {
  it("sends a JSON import payload", async () => {
    const dependencies = buildDependencies();

    const result = await runDomainTableCustomAction(
      { ...target, actionId: "import", payloadJson: "[]" },
      dependencies,
    );

    expect(dependencies.runJsonImport).toHaveBeenCalledWith(
      "acme",
      "orders",
      "import",
      "[]",
    );
    expect(result).toEqual({ ok: true, data: { added: 2, updated: 1 } });
  });

  it("requires a payload for a JSON import", async () => {
    const dependencies = buildDependencies();

    const result = await runDomainTableCustomAction(
      { ...target, actionId: "import" },
      dependencies,
    );

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(dependencies.runJsonImport).not.toHaveBeenCalled();
  });

  it("runs a danger-confirm action without the caller knowing its token", async () => {
    const dependencies = buildDependencies();

    const result = await runDomainTableCustomAction(
      { ...target, actionId: "reset-all" },
      dependencies,
    );

    expect(dependencies.runDangerConfirm).toHaveBeenCalledWith(
      "acme",
      "orders",
      "reset-all",
    );
    expect(result).toEqual({ ok: true, data: { deleted: 7 } });
  });

  it("returns 404 for an unknown action", async () => {
    const dependencies = buildDependencies();

    const result = await runDomainTableCustomAction(
      { ...target, actionId: "missing" },
      dependencies,
    );

    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

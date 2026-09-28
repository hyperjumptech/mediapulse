import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

import { DomainCreateModal } from "./domain-create-modal";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

const symbolField: DomainTableFormField = {
  kind: "string",
  key: "symbol",
  label: "Symbol",
  required: true,
  nullable: false,
};

const openFromUrl = (
  createAction = vi.fn<(formData: FormData) => Promise<void>>(async () => {}),
) => {
  searchParams.current = "create=1";
  render(
    <DomainCreateModal
      fields={[symbolField]}
      createAction={createAction}
      title="Add Tickers"
    />,
  );

  return createAction;
};

describe("DomainCreateModal", () => {
  afterEach(() => {
    searchParams.current = "";
    vi.restoreAllMocks();
  });

  it("renders nothing when the manifest has no create fields", () => {
    searchParams.current = "create=1";

    const { container } = render(
      <DomainCreateModal fields={[]} createAction={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed and renders no trigger of its own without a create request", () => {
    render(<DomainCreateModal fields={[symbolField]} createAction={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the create form from the create URL flag", () => {
    openFromUrl();

    expect(
      screen.getByRole("dialog", { name: "Add Tickers" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("closes and drops the create flag from the URL when Cancel is clicked", () => {
    window.history.replaceState(null, "", "/dashboard/acme/items?create=1");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    openFromUrl();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const nextUrl = String(replaceStateSpy.mock.calls.at(-1)?.[2]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nextUrl).toMatch(/\/dashboard\/acme\/items$/);
  });

  it("submits the form to the create action and closes", async () => {
    const createAction = openFromUrl();
    fireEvent.change(screen.getByLabelText(/Symbol/), {
      target: { value: "ACME" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const submitted = createAction.mock.calls[0]?.[0] as FormData | undefined;

    expect(submitted?.get("symbol")).toBe("ACME");
  });
});

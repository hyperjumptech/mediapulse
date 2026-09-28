import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteHeaderAction } from "./site-header-action";

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/dashboard" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => pathname.current,
}));

afterEach(() => {
  pathname.current = "/dashboard";
});

describe("SiteHeaderAction", () => {
  it("offers Quick Create on the overview", () => {
    render(<SiteHeaderAction />);

    expect(
      screen.getByRole("button", { name: "Quick create" }),
    ).toBeInTheDocument();
  });

  it("shows the page's own primary action on a list page", () => {
    pathname.current = "/dashboard/variables";

    render(<SiteHeaderAction />);

    expect(screen.getByRole("link", { name: "Add variable" })).toHaveAttribute(
      "href",
      "/dashboard/variables?create=1",
    );
    expect(
      screen.queryByRole("button", { name: "Quick create" }),
    ).not.toBeInTheDocument();
  });

  it("links to a full create page when the page has one", () => {
    pathname.current = "/dashboard/agent-configs";

    render(<SiteHeaderAction />);

    expect(screen.getByRole("link", { name: "Add config" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/new",
    );
  });

  it("shows nothing on pages without a primary action", () => {
    pathname.current = "/dashboard/agents";

    const { container } = render(<SiteHeaderAction />);

    expect(container).toBeEmptyDOMElement();
  });
});

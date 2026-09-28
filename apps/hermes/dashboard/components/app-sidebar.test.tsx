import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardPage } from "@hermes/domain-contract";

import {
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";

import { AppSidebar } from "./app-sidebar";
import {
  CommandPaletteProvider,
  useCommandPaletteContext,
} from "./command-palette-provider";
import type { DomainIntegrationNav } from "@/lib/dashboard-routes";

type MockLinkProps = React.ComponentProps<"a"> & { href: string };

const usePathnameMock = vi.fn();
const useLinkStatusMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...props }: MockLinkProps) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useLinkStatus: () => useLinkStatusMock(),
}));

vi.mock("@/app/dashboard/logout-form", () => ({
  LogoutForm: ({ className }: { className?: string }) => (
    <button data-testid="logout-form" className={className}>
      Sign out
    </button>
  ),
}));

vi.mock("./nav-user", () => ({
  NavUser: ({ user }: { user: { name: string; email: string } }) => (
    <div data-testid="nav-user">
      <span>{user.name}</span>
      <span>{user.email}</span>
    </div>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const createDomainPage = (
  id: string,
  label: string,
  order: number,
): DashboardPage => ({
  id,
  label,
  pathSegment: id,
  kind: "resource-table",
  placement: "sidebar",
  apiPrefix: `/v1/hermes-dashboard/${id}`,
  columns: [],
  searchableFields: [],
  sortableFields: [],
  actions: { create: true, update: true, delete: true, view: false },
  order,
  customActions: [],
  createNavigation: "modal",
});

const domainIntegrations: DomainIntegrationNav[] = [
  {
    integrationId: "mediapulse",
    name: "Mediapulse",
    views: [
      createDomainPage("tickers", "Tickers", 10),
      createDomainPage("search-queries", "Search Queries", 20),
      createDomainPage("entity-types", "Entity Types", 30),
      createDomainPage("relation-types", "Relation Types", 40),
      createDomainPage("publishers", "Publishers", 50),
    ],
  },
];

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 500;

const stubViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: width < 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

type RenderSidebarOptions = {
  user?: { name: string; email: string } | null;
  integrations?: Promise<DomainIntegrationNav[]>;
  defaultOpen?: boolean;
};

const renderSidebar = async ({
  user,
  integrations = Promise.resolve(domainIntegrations),
  defaultOpen = true,
}: RenderSidebarOptions = {}) => {
  await act(async () => {
    render(
      <SidebarProvider defaultOpen={defaultOpen}>
        <CommandPaletteProvider>
          <AppSidebar user={user} domainIntegrations={integrations} />
          <SidebarTrigger />
          <PaletteStateProbe />
        </CommandPaletteProvider>
      </SidebarProvider>,
    );
  });
};

const PaletteStateProbe = () => {
  const { open } = useCommandPaletteContext();

  return (
    <output data-testid="palette-state">{open ? "open" : "closed"}</output>
  );
};

const getNavLink = (name: string) => screen.getByRole("link", { name });

const getSidebarRoot = () =>
  document.querySelector<HTMLElement>('[data-slot="sidebar"]');

describe("AppSidebar", () => {
  beforeEach(() => {
    stubViewport(DESKTOP_WIDTH);
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useLinkStatusMock.mockReturnValue({ pending: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    usePathnameMock.mockReset();
    useLinkStatusMock.mockReset();
  });

  it("renders the Hermes brand linking to the dashboard", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/pipelines");

    // Act
    await renderSidebar();

    // Assert
    const brandLink = screen.getByRole("link", { name: /Hermes/ });

    expect(brandLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders Hermes groups followed by integration groups", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderSidebar();

    // Assert
    const groupLabels = Array.from(
      document.querySelectorAll('[data-sidebar="group-label"]'),
      (groupLabel) => groupLabel.textContent,
    );

    expect(groupLabels).toEqual(["Home", "Agents", "Mediapulse"]);
  });

  it("links every Hermes section and integration view", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderSidebar();

    // Assert
    expect(getNavLink("Overview")).toHaveAttribute("href", "/dashboard");
    expect(getNavLink("Pipelines")).toHaveAttribute(
      "href",
      "/dashboard/pipelines",
    );
    expect(getNavLink("HTTP triggers")).toHaveAttribute(
      "href",
      "/dashboard/http-triggers",
    );
    expect(getNavLink("Agent contracts")).toHaveAttribute(
      "href",
      "/dashboard/agent-contracts",
    );
    expect(getNavLink("API keys")).toHaveAttribute(
      "href",
      "/dashboard/api-keys",
    );
    expect(getNavLink("Tickers")).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers",
    );
    expect(getNavLink("Relation Types")).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/relation-types",
    );
  });

  it.each([
    ["/dashboard", "Overview"],
    ["/dashboard/agents", "Agents"],
    ["/dashboard/schedules/schedule-1", "Schedules"],
    ["/dashboard/domain-integrations", "Domain integrations"],
    ["/dashboard/mediapulse/tickers", "Tickers"],
    ["/dashboard/mediapulse/search-queries/item-1/edit", "Search Queries"],
    ["/dashboard/mediapulse/publishers", "Publishers"],
  ])("marks the item for %s as active", async (pathname, activeLabel) => {
    // Setup
    usePathnameMock.mockReturnValue(pathname);

    // Act
    await renderSidebar();

    // Assert
    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-active") === "true");
    const activeLink = getNavLink(activeLabel);

    expect(activeLinks).toEqual([activeLink]);
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("does not mark Agents active on agent configs", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard/agent-configs");

    // Act
    await renderSidebar();

    // Assert
    expect(getNavLink("Agents")).toHaveAttribute("data-active", "false");
    expect(getNavLink("Agent configs")).toHaveAttribute("data-active", "true");
  });

  it("shows three skeleton rows while integrations load", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    const pendingIntegrations = new Promise<DomainIntegrationNav[]>(() => {});

    // Act
    await renderSidebar({ integrations: pendingIntegrations });

    // Assert
    const skeleton = screen.getByTestId("domain-integration-nav-skeleton");

    expect(
      skeleton.querySelectorAll('[data-sidebar="menu-skeleton"]'),
    ).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Tickers" })).toBeNull();
  });

  it("slides off canvas as a flat sidebar when collapsed", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderSidebar({ defaultOpen: false });

    // Assert
    const sidebarRoot = getSidebarRoot();

    expect(sidebarRoot).toHaveAttribute("data-state", "collapsed");
    expect(sidebarRoot).toHaveAttribute("data-collapsible", "offcanvas");
    expect(sidebarRoot).toHaveAttribute("data-variant", "sidebar");
  });

  it("tucks integration views past the fourth under More", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    await renderSidebar();

    // Act
    await act(async () => {
      screen.getByRole("button", { name: "More" }).click();
    });

    // Assert
    expect(getNavLink("Publishers")).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/publishers",
    );
  });

  it("keeps More closed until one of its views is active", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");

    // Act
    await renderSidebar();

    // Assert
    expect(screen.queryByRole("link", { name: "Publishers" })).toBeNull();
  });

  it("opens the command palette from Search", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    await renderSidebar();

    // Act
    await act(async () => {
      screen.getByRole("button", { name: /Search/ }).click();
    });

    // Assert
    expect(screen.getByTestId("palette-state")).toHaveTextContent("open");
  });

  it("pulses the pending indicator while navigating", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    useLinkStatusMock.mockReturnValue({ pending: true });

    // Act
    await renderSidebar();

    // Assert
    const pendingIndicator =
      getNavLink("Pipelines").querySelector("span[aria-hidden]");

    expect(pendingIndicator).toHaveClass("animate-pulse", "opacity-100");
  });

  it("closes the mobile sidebar after choosing a link", async () => {
    // Setup
    stubViewport(MOBILE_WIDTH);
    usePathnameMock.mockReturnValue("/dashboard");
    await renderSidebar();
    await act(async () => {
      screen.getByRole("button", { name: "Toggle Sidebar" }).click();
    });
    const mobileSidebar = screen.getByRole("dialog");

    // Act
    await act(async () => {
      within(mobileSidebar).getByRole("link", { name: "Pipelines" }).click();
    });

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders NavUser when a user is provided", async () => {
    // Setup
    usePathnameMock.mockReturnValue("/dashboard");
    const user = { name: "John Doe", email: "john@example.com" };

    // Act
    await renderSidebar({ user });

    // Assert
    expect(screen.getByTestId("nav-user")).toHaveTextContent("John Doe");
    expect(screen.queryByTestId("logout-form")).not.toBeInTheDocument();
  });

  it.each([undefined, null])(
    "renders the logout form when the user is %s",
    async (user) => {
      // Setup
      usePathnameMock.mockReturnValue("/dashboard");

      // Act
      await renderSidebar({ user });

      // Assert
      expect(screen.getByTestId("logout-form")).toBeInTheDocument();
      expect(screen.queryByTestId("nav-user")).not.toBeInTheDocument();
    },
  );
});

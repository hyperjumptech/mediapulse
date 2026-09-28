import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Calendar, GitBranch, LayoutDashboard } from "lucide-react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { DashboardSearchResult } from "@/lib/dashboard-search-contract";

import {
  CommandPalette,
  type CommandPaletteDomainIntegration,
} from "./command-palette";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/dashboard-routes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dashboard-routes")>()),
  dashboardNavGroups: [
    {
      label: "Overview",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Orchestration",
      items: [
        { href: "/dashboard/pipelines", label: "Pipelines", icon: GitBranch },
        { href: "/dashboard/schedules", label: "Schedules", icon: Calendar },
      ],
    },
  ],
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const SEARCH_PLACEHOLDER = "Search pages, pipelines, schedules, agents…";

const domainIntegrations: CommandPaletteDomainIntegration[] = [
  {
    integrationId: "acme",
    name: "Acme",
    views: [
      { id: "articles", label: "Articles", pathSegment: "articles" },
      { id: "sources", label: "Sources", pathSegment: "data/sources" },
      { id: "briefing", label: "Briefing" },
    ],
  },
];

const pipelineResult: DashboardSearchResult = {
  type: "pipeline",
  id: "pipeline-1",
  label: "Daily digest",
  description: "Runs every morning",
  href: "/dashboard/pipelines/pipeline-1",
};

const agentResult: DashboardSearchResult = {
  type: "agent",
  id: "agent-1",
  label: "daily-summarizer@1.2.0",
  href: "/dashboard/agents/agent-1",
};

const variableResult: DashboardSearchResult = {
  type: "variable",
  id: "variable-1",
  label: "DAILY_LIMIT",
  href: "/dashboard/variables?q=DAILY_LIMIT",
};

const createSearchResponse = (results: DashboardSearchResult[]): Response =>
  new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const renderPalette = async (
  integrations: Promise<CommandPaletteDomainIntegration[]> = Promise.resolve(
    domainIntegrations,
  ),
) => {
  await act(async () => {
    render(<CommandPalette domainIntegrations={integrations} />);
  });
};

const openPaletteWithTrigger = async () => {
  const desktopTrigger = screen.getByRole("button", { name: /Search…/ });
  await act(async () => {
    fireEvent.click(desktopTrigger);
  });

  return screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
};

const typeQuery = (input: HTMLElement, query: string) => {
  fireEvent.change(input, { target: { value: query } });
};

const getPageOptionLabels = () => {
  const pagesGroup = screen.getByRole("group", { name: "Pages" });

  return within(pagesGroup)
    .getAllByRole("option")
    .map((option) => option.textContent);
};

describe("CommandPalette", () => {
  const fetchMock = vi.fn();

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(createSearchResponse([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    pushMock.mockReset();
  });

  it("renders a desktop search trigger with the shortcut hint and a mobile icon trigger", async () => {
    // Act
    await renderPalette();

    // Assert
    const desktopTrigger = screen.getByRole("button", { name: /Search…/ });
    const mobileTrigger = screen.getByRole("button", { name: "Search" });

    expect(within(desktopTrigger).getByText("⌘K")).toBeInTheDocument();
    expect(desktopTrigger).toHaveClass("hidden", "sm:inline-flex", "w-56");
    expect(mobileTrigger).toHaveClass("sm:hidden");
    expect(
      screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
    ).not.toBeInTheDocument();
  });

  it("opens from either trigger and lists static pages with domain integration views", async () => {
    // Setup
    await renderPalette();

    // Act
    await openPaletteWithTrigger();

    // Assert
    expect(getPageOptionLabels()).toEqual([
      "Dashboard",
      "Pipelines",
      "Schedules",
      "Acme › Articles",
      "Acme › Sources",
      "Acme › Briefing",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();

    // Act
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
        key: "Escape",
      });
    });

    // Assert
    expect(
      screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
    ).not.toBeInTheDocument();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
    });

    // Assert
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue("");
  });

  it("shows only static pages while domain integrations are still loading", async () => {
    // Setup
    const pendingIntegrations = new Promise<CommandPaletteDomainIntegration[]>(
      () => undefined,
    );
    await renderPalette(pendingIntegrations);

    // Act
    await openPaletteWithTrigger();

    // Assert
    expect(getPageOptionLabels()).toEqual([
      "Dashboard",
      "Pipelines",
      "Schedules",
    ]);
  });

  it("filters static and integration pages by the query, case-insensitively", async () => {
    // Setup
    await renderPalette();
    const input = await openPaletteWithTrigger();

    // Act
    typeQuery(input, "  SCHED ");

    // Assert
    expect(getPageOptionLabels()).toEqual(["Schedules"]);

    // Act
    typeQuery(input, "acme › s");

    // Assert
    expect(getPageOptionLabels()).toEqual(["Acme › Sources"]);
  });

  it.each([
    ["Acme › Sources", "/dashboard/acme/data/sources"],
    ["Acme › Briefing", "/dashboard/acme/briefing"],
  ])(
    "navigates the %s integration page to its view path",
    async (pageLabel, expectedHref) => {
      // Setup
      await renderPalette();
      await openPaletteWithTrigger();
      const pageOption = screen.getByRole("option", { name: pageLabel });

      // Act
      await act(async () => {
        fireEvent.click(pageOption);
      });

      // Assert
      expect(pushMock).toHaveBeenCalledWith(expectedHref);
    },
  );

  it("renders grouped entity results and navigates to the selected result", async () => {
    // Setup
    fetchMock.mockResolvedValue(
      createSearchResponse([pipelineResult, agentResult, variableResult]),
    );
    await renderPalette();
    const input = await openPaletteWithTrigger();

    // Act
    typeQuery(input, "daily");

    // Assert
    const pipelinesGroup = await screen.findByRole("group", {
      name: "Pipelines",
    });
    const agentsGroup = screen.getByRole("group", { name: "Agents" });
    const variablesGroup = screen.getByRole("group", { name: "Variables" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/dashboard-search?q=daily",
    );
    expect(within(pipelinesGroup).getByText("Daily digest")).toBeVisible();
    expect(
      within(pipelinesGroup).getByText("Runs every morning"),
    ).toBeVisible();
    expect(
      within(agentsGroup).getByText("daily-summarizer@1.2.0"),
    ).toBeVisible();
    expect(within(variablesGroup).getByText("DAILY_LIMIT")).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Schedules" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pages" })).toBeNull();

    // Act
    await act(async () => {
      fireEvent.click(within(agentsGroup).getByRole("option"));
    });

    // Assert
    expect(pushMock).toHaveBeenCalledWith("/dashboard/agents/agent-1");
    expect(
      screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
    ).not.toBeInTheDocument();
  });

  it("navigates to a page with the keyboard", async () => {
    // Setup
    await renderPalette();
    const input = await openPaletteWithTrigger();

    // Act
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Assert
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/pipelines");
    expect(
      screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
    ).not.toBeInTheDocument();
  });

  it("shows a searching row while the request is pending and an empty state when nothing matches", async () => {
    // Setup
    let resolveSearch: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveSearch = resolve;
      }),
    );
    await renderPalette();
    const input = await openPaletteWithTrigger();

    // Act
    typeQuery(input, "zzz");

    // Assert
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(screen.queryByText("No results.")).not.toBeInTheDocument();

    // Act
    await act(async () => {
      resolveSearch(createSearchResponse([]));
    });

    // Assert
    expect(await screen.findByText("No results.")).toBeInTheDocument();
    expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
  });

  it("toggles with Cmd+K, including from the palette's own input", async () => {
    // Setup
    await renderPalette();

    // Act
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    });

    // Assert
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

    expect(input).toBeInTheDocument();

    // Act
    await act(async () => {
      fireEvent.keyDown(input, { key: "k", metaKey: true });
    });

    // Assert
    expect(
      screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
    ).not.toBeInTheDocument();
  });
});

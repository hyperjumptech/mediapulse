"use client";

import { useRouter } from "next/navigation";
import { Suspense, use } from "react";
import {
  Bot,
  Calendar,
  Database,
  FileJson,
  GitBranch,
  Radio,
  Search,
  Variable,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import { Kbd } from "@workspace/ui/components/kbd";
import { Spinner } from "@workspace/ui/components/spinner";

import { useCommandPalette } from "@/hooks/use-command-palette";
import {
  buildDomainIntegrationViewHref,
  dashboardNavGroups,
} from "@/lib/dashboard-routes";
import {
  DASHBOARD_SEARCH_MAXIMUM_QUERY_LENGTH,
  type DashboardSearchResult,
  type DashboardSearchResultType,
} from "@/lib/dashboard-search-contract";

export type CommandPaletteDomainIntegration = {
  integrationId: string;
  name: string;
  views: Array<{ id: string; label: string; pathSegment?: string }>;
};

type CommandPalettePage = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavigateToHref = (href: string) => void;

type EntityGroupDefinition = {
  type: DashboardSearchResultType;
  heading: string;
  icon: LucideIcon;
};

type EntityGroup = EntityGroupDefinition & {
  results: DashboardSearchResult[];
};

const ENTITY_GROUP_DEFINITIONS: EntityGroupDefinition[] = [
  { type: "pipeline", heading: "Pipelines", icon: GitBranch },
  { type: "schedule", heading: "Schedules", icon: Calendar },
  { type: "httpTrigger", heading: "HTTP triggers", icon: Radio },
  { type: "agent", heading: "Agents", icon: Bot },
  { type: "agentConfig", heading: "Agent configs", icon: FileJson },
  { type: "variable", heading: "Variables", icon: Variable },
];

const STATIC_PAGES: CommandPalettePage[] = dashboardNavGroups.flatMap(
  (group) => group.items,
);

const buildIntegrationPages = (
  domainIntegrations: CommandPaletteDomainIntegration[],
): CommandPalettePage[] =>
  domainIntegrations.flatMap((integration) =>
    integration.views.map(
      (view): CommandPalettePage => ({
        href: buildDomainIntegrationViewHref(integration.integrationId, view),
        label: `${integration.name} › ${view.label}`,
        icon: Database,
      }),
    ),
  );

const filterPages = (
  pages: CommandPalettePage[],
  query: string,
): CommandPalettePage[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return pages;
  }

  return pages.filter((page) =>
    page.label.toLowerCase().includes(normalizedQuery),
  );
};

const groupSearchResults = (results: DashboardSearchResult[]): EntityGroup[] =>
  ENTITY_GROUP_DEFINITIONS.map((definition) => ({
    ...definition,
    results: results.filter((result) => result.type === definition.type),
  })).filter((group) => group.results.length > 0);

const CommandPalettePageGroup = ({
  pages,
  onNavigate,
}: {
  pages: CommandPalettePage[];
  onNavigate: NavigateToHref;
}) => {
  if (pages.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading="Pages">
      {pages.map((page) => (
        <CommandItem
          key={page.href}
          value={`page:${page.href}`}
          onSelect={() => onNavigate(page.href)}
        >
          <page.icon />
          <span className="truncate">{page.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
};

const CommandPaletteIntegrationPageGroup = ({
  domainIntegrations,
  query,
  onNavigate,
}: {
  domainIntegrations: Promise<CommandPaletteDomainIntegration[]>;
  query: string;
  onNavigate: NavigateToHref;
}) => {
  const resolvedIntegrations = use(domainIntegrations);
  const integrationPages = buildIntegrationPages(resolvedIntegrations);
  const matchingPages = filterPages(
    [...STATIC_PAGES, ...integrationPages],
    query,
  );

  return (
    <CommandPalettePageGroup pages={matchingPages} onNavigate={onNavigate} />
  );
};

const CommandPaletteEntityGroup = ({
  group,
  onNavigate,
}: {
  group: EntityGroup;
  onNavigate: NavigateToHref;
}) => (
  <CommandGroup heading={group.heading}>
    {group.results.map((result) => (
      <CommandItem
        key={`${result.type}:${result.id}`}
        value={`${result.type}:${result.id}`}
        onSelect={() => onNavigate(result.href)}
      >
        <group.icon />
        <span className="truncate">{result.label}</span>
        {result.description ? (
          <span className="ml-auto max-w-[50%] truncate text-xs text-muted-foreground">
            {result.description}
          </span>
        ) : null}
      </CommandItem>
    ))}
  </CommandGroup>
);

const CommandPaletteSearchingRow = () => (
  <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
    <Spinner />
    <span>Searching…</span>
  </div>
);

const commandOptions = {
  shouldFilter: false,
  label: "Search dashboard",
};

export const CommandPalette = ({
  domainIntegrations,
}: {
  domainIntegrations: Promise<CommandPaletteDomainIntegration[]>;
}) => {
  const router = useRouter();
  const { open, setOpen, query, setQuery, results, isSearching } =
    useCommandPalette();
  const staticPages = filterPages(STATIC_PAGES, query);
  const entityGroups = groupSearchResults(results);

  const openPalette = () => {
    setOpen(true);
  };
  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground shadow-none sm:inline-flex"
        onClick={openPalette}
      >
        <Search />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="sm:hidden"
        aria-label="Search"
        onClick={openPalette}
      >
        <Search />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search dashboard"
        description="Search pages, pipelines, schedules, HTTP triggers, agents, agent configs, and variables."
        commandProps={commandOptions}
      >
        <CommandInput
          data-command-palette-input=""
          placeholder="Search pages, pipelines, schedules, agents…"
          value={query}
          onValueChange={setQuery}
          maxLength={DASHBOARD_SEARCH_MAXIMUM_QUERY_LENGTH}
        />
        <CommandList>
          <Suspense
            fallback={
              <CommandPalettePageGroup
                pages={staticPages}
                onNavigate={navigateTo}
              />
            }
          >
            <CommandPaletteIntegrationPageGroup
              domainIntegrations={domainIntegrations}
              query={query}
              onNavigate={navigateTo}
            />
          </Suspense>
          {entityGroups.map((group) => (
            <CommandPaletteEntityGroup
              key={group.type}
              group={group}
              onNavigate={navigateTo}
            />
          ))}
          {isSearching ? (
            <CommandPaletteSearchingRow />
          ) : (
            <CommandEmpty>No results.</CommandEmpty>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};

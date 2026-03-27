import * as React from "react";

import type { LoadExpansionsPageResult, LoadPageArgs } from "../types";

type DseDisplaySegment = {
  kind: "dse-reference";
  id: string;
};

export type UseExpansionDisplayNameCacheArgs = {
  displaySegments: Array<{ kind: "text" } | DseDisplaySegment>;
  resolveExpansionNameById?: (id: string) => Promise<string | null>;
  loadExpansionsPage: (args: LoadPageArgs) => Promise<LoadExpansionsPageResult>;
  /** Prefetched names (e.g. from RSC) applied before async resolution. */
  initialExpansionNames?: Readonly<Record<string, string>>;
};

export type UseExpansionDisplayNameCacheResult = {
  getExpansionDisplayName: (id: string) => string;
  rememberExpansionName: (id: string, name: string) => void;
  loadExpansionsPageWithNameCache: (
    args: LoadPageArgs,
  ) => Promise<LoadExpansionsPageResult>;
};

/**
 * Keeps an id->name cache for `{{dse:<id>}}` display labels and resolves missing ids on demand.
 *
 * @param args - Current display segments and loader/resolver collaborators.
 * @returns Name lookup helpers and wrapped expansions page loader.
 */
export const useExpansionDisplayNameCache = ({
  displaySegments,
  resolveExpansionNameById,
  loadExpansionsPage,
  initialExpansionNames,
}: UseExpansionDisplayNameCacheArgs): UseExpansionDisplayNameCacheResult => {
  const [, setVersion] = React.useState(0);
  const expansionNameByIdRef = React.useRef<Record<string, string>>({});
  const pendingResolutionIdsRef = React.useRef<Set<string>>(new Set<string>());

  if (initialExpansionNames != null) {
    for (const [id, name] of Object.entries(initialExpansionNames)) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (trimmed !== "") {
        expansionNameByIdRef.current[id] = trimmed;
      }
    }
  }

  const getExpansionDisplayName = React.useCallback((id: string): string => {
    const cachedName = expansionNameByIdRef.current[id];
    if (cachedName != null && cachedName.trim() !== "") {
      return cachedName;
    }
    return `dse:${id}`;
  }, []);

  const rememberExpansionName = React.useCallback(
    (id: string, name: string) => {
      if (name.trim() === "") {
        return;
      }
      expansionNameByIdRef.current[id] = name;
      setVersion((current) => current + 1);
    },
    [],
  );

  const loadExpansionsPageWithNameCache = React.useCallback(
    async (args: LoadPageArgs): Promise<LoadExpansionsPageResult> => {
      const result = await loadExpansionsPage(args);
      let updated = false;
      for (const item of result.items) {
        if (item.name.trim() === "") {
          continue;
        }
        const existing = expansionNameByIdRef.current[item.id];
        if (existing === item.name) {
          continue;
        }
        expansionNameByIdRef.current[item.id] = item.name;
        updated = true;
      }
      if (updated) {
        setVersion((current) => current + 1);
      }
      return result;
    },
    [loadExpansionsPage],
  );

  React.useEffect(() => {
    if (resolveExpansionNameById == null) {
      return;
    }
    const missingIds = displaySegments
      .filter((segment) => segment.kind === "dse-reference")
      .map((segment) => segment.id)
      .filter((id) => {
        const hasName = (expansionNameByIdRef.current[id] ?? "").trim() !== "";
        const isPending = pendingResolutionIdsRef.current.has(id);
        return !hasName && !isPending;
      });
    if (missingIds.length === 0) {
      return;
    }

    let cancelled = false;
    for (const id of missingIds) {
      pendingResolutionIdsRef.current.add(id);
    }

    void Promise.all(
      missingIds.map(async (id) => {
        const name = await resolveExpansionNameById(id);
        return { id, name };
      }),
    )
      .then((rows) => {
        if (cancelled) {
          return;
        }
        let updated = false;
        for (const row of rows) {
          if (row.name == null || row.name.trim() === "") {
            continue;
          }
          expansionNameByIdRef.current[row.id] = row.name;
          updated = true;
        }
        if (updated) {
          setVersion((current) => current + 1);
        }
      })
      .finally(() => {
        for (const id of missingIds) {
          pendingResolutionIdsRef.current.delete(id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displaySegments, resolveExpansionNameById]);

  return {
    getExpansionDisplayName,
    rememberExpansionName,
    loadExpansionsPageWithNameCache,
  };
};

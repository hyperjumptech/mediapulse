import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardSearchResult } from "@/lib/dashboard-search-contract";

import {
  COMMAND_PALETTE_INPUT_ATTRIBUTE,
  COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS,
  fetchDashboardSearchResults,
  useCommandPalette,
} from "./use-command-palette";

const pipelineResult: DashboardSearchResult = {
  type: "pipeline",
  id: "pipeline-1",
  label: "Daily digest",
  href: "/dashboard/pipelines/pipeline-1",
};

const scheduleResult: DashboardSearchResult = {
  type: "schedule",
  id: "schedule-1",
  label: "Pipeline nightly",
  href: "/dashboard/schedules/schedule-1",
};

const createSearchResponse = (
  results: DashboardSearchResult[],
  status = 200,
): Response =>
  new Response(JSON.stringify({ results }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const createDeferredResponse = () => {
  let resolveResponse: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return { promise, resolve: resolveResponse };
};

const pressShortcut = (
  target: EventTarget,
  eventInit: KeyboardEventInit = { key: "k", metaKey: true },
): KeyboardEvent => {
  const keyboardEvent = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...eventInit,
  });
  act(() => {
    target.dispatchEvent(keyboardEvent);
  });

  return keyboardEvent;
};

const advanceDebounce = async (milliseconds: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

const getRequestedUrl = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  String(fetchMock.mock.calls[call]?.[0]);

const getRequestSignal = (
  fetchMock: ReturnType<typeof vi.fn>,
  call: number,
): AbortSignal => {
  const requestInit = fetchMock.mock.calls[call]?.[1] as RequestInit;

  return requestInit.signal as AbortSignal;
};

describe("useCommandPalette", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    document.body.innerHTML = "";
  });

  it("starts closed with an empty query and no results", () => {
    // Act
    const { result } = renderHook(() => useCommandPalette());

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("toggles open with Cmd+K and Ctrl+K and prevents the browser default", () => {
    // Setup
    const { result } = renderHook(() => useCommandPalette());

    // Act
    const commandEvent = pressShortcut(document);

    // Assert
    expect(result.current.open).toBe(true);
    expect(commandEvent.defaultPrevented).toBe(true);

    // Act
    const controlEvent = pressShortcut(document, { key: "K", ctrlKey: true });

    // Assert
    expect(result.current.open).toBe(false);
    expect(controlEvent.defaultPrevented).toBe(true);
  });

  it.each([
    { key: "k" },
    { key: "j", metaKey: true },
    { key: "Enter", ctrlKey: true },
  ])("ignores the key combination %j", (eventInit) => {
    // Setup
    const { result } = renderHook(() => useCommandPalette());

    // Act
    const keyboardEvent = pressShortcut(document, eventInit);

    // Assert
    expect(result.current.open).toBe(false);
    expect(keyboardEvent.defaultPrevented).toBe(false);
  });

  it.each([
    ["an input", () => document.createElement("input")],
    ["a textarea", () => document.createElement("textarea")],
    [
      "a contenteditable descendant",
      () => {
        const editor = document.createElement("div");
        editor.setAttribute("contenteditable", "true");
        const paragraph = document.createElement("p");
        editor.append(paragraph);

        return editor;
      },
    ],
  ])("ignores the shortcut while focus is in %s", (_label, createElement) => {
    // Setup
    const { result } = renderHook(() => useCommandPalette());
    const element = createElement();
    document.body.append(element);
    const target = element.firstElementChild ?? element;

    // Act
    const keyboardEvent = pressShortcut(target);

    // Assert
    expect(result.current.open).toBe(false);
    expect(keyboardEvent.defaultPrevented).toBe(false);
  });

  it("toggles from a non-editable element and from the palette's own input", () => {
    // Setup
    const { result } = renderHook(() => useCommandPalette());
    const button = document.createElement("button");
    const paletteInput = document.createElement("input");
    paletteInput.setAttribute(COMMAND_PALETTE_INPUT_ATTRIBUTE, "");
    const disabledEditor = document.createElement("div");
    disabledEditor.setAttribute("contenteditable", "false");
    document.body.append(button, paletteInput, disabledEditor);

    // Act
    pressShortcut(button);

    // Assert
    expect(result.current.open).toBe(true);

    // Act
    pressShortcut(paletteInput);

    // Assert
    expect(result.current.open).toBe(false);

    // Act
    pressShortcut(disabledEditor);

    // Assert
    expect(result.current.open).toBe(true);
  });

  it("stops listening for the shortcut after unmount", () => {
    // Setup
    const { result, unmount } = renderHook(() => useCommandPalette());
    unmount();

    // Act
    const keyboardEvent = pressShortcut(document);

    // Assert
    expect(keyboardEvent.defaultPrevented).toBe(false);
    expect(result.current.open).toBe(false);
  });

  it("debounces the search request and returns its results", async () => {
    // Setup
    fetchMock.mockResolvedValue(createSearchResponse([pipelineResult]));
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
    });

    // Act
    act(() => {
      result.current.setQuery("d");
    });
    act(() => {
      result.current.setQuery("da");
    });
    act(() => {
      result.current.setQuery(" dai ");
    });
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS - 1);

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(true);

    // Act
    await advanceDebounce(1);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestedUrl(fetchMock, 0)).toBe("/api/dashboard-search?q=dai");
    expect(result.current.results).toEqual([pipelineResult]);
    expect(result.current.isSearching).toBe(false);
  });

  it("does not search while closed or for queries shorter than two characters", async () => {
    // Setup
    const { result } = renderHook(() => useCommandPalette());

    // Act
    act(() => {
      result.current.setQuery("daily");
    });
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery(" d ");
    });
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it("aborts the in-flight request when the query changes and ignores its late response", async () => {
    // Setup
    const staleResponse = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(staleResponse.promise)
      .mockResolvedValueOnce(createSearchResponse([scheduleResult]));
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery("pi");
    });
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);
    const staleSignal = getRequestSignal(fetchMock, 0);

    // Act
    act(() => {
      result.current.setQuery("pip");
    });

    // Assert
    expect(staleSignal.aborted).toBe(true);

    // Act
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);
    await act(async () => {
      staleResponse.resolve(createSearchResponse([pipelineResult]));
      await Promise.resolve();
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestedUrl(fetchMock, 1)).toBe("/api/dashboard-search?q=pip");
    expect(getRequestSignal(fetchMock, 1).aborted).toBe(false);
    expect(result.current.results).toEqual([scheduleResult]);
    expect(result.current.isSearching).toBe(false);
  });

  it("settles on no results when the request fails", async () => {
    // Setup
    fetchMock.mockResolvedValue(createSearchResponse([], 500));
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery("daily");
    });

    // Act
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("clears the query and results when closed, including by the shortcut", async () => {
    // Setup
    fetchMock.mockResolvedValue(createSearchResponse([pipelineResult]));
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery("daily");
    });
    await advanceDebounce(COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);

    expect(result.current.results).toEqual([pipelineResult]);

    // Act
    act(() => {
      result.current.setOpen(false);
    });

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);

    // Act
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery("daily");
    });

    // Assert
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(true);

    // Act
    pressShortcut(document);

    // Assert
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.isSearching).toBe(false);
  });
});

describe("fetchDashboardSearchResults", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the encoded query with the abort signal and returns the results", async () => {
    // Setup
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createSearchResponse([pipelineResult]));
    vi.stubGlobal("fetch", fetchMock);
    const abortController = new AbortController();

    // Act
    const results = await fetchDashboardSearchResults(
      "a&b c",
      abortController.signal,
    );

    // Assert
    expect(results).toEqual([pipelineResult]);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard-search?q=a%26b+c", {
      signal: abortController.signal,
    });
  });

  it("throws when the response is not successful", async () => {
    // Setup
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createSearchResponse([], 401)),
    );

    // Act
    const searchPromise = fetchDashboardSearchResults(
      "daily",
      new AbortController().signal,
    );

    // Assert
    await expect(searchPromise).rejects.toThrow(
      "Dashboard search failed with status 401",
    );
  });
});

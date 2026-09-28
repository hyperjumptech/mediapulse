import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useOverviewActivityView } from "./use-overview-activity-view";

const buildViewSwitcher = () => {
  const viewSwitcher = document.createElement("div");
  viewSwitcher.innerHTML = `
    <button role="combobox" type="button">View</button>
    <div role="tablist">
      <button role="tab" data-state="inactive" type="button">Running</button>
      <button role="tab" data-state="active" type="button">Failed</button>
    </div>
  `;
  document.body.append(viewSwitcher);

  return viewSwitcher;
};

const focusElementWithRole = (role: string) => {
  const element = document.createElement("div");
  element.setAttribute("role", role);
  element.tabIndex = 0;
  document.body.append(element);
  element.focus();
};

describe("useOverviewActivityView", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("starts on running and ignores unknown views", () => {
    const { result } = renderHook(() => useOverviewActivityView());

    act(() => {
      result.current.changeView("archived");
    });

    expect(result.current.view).toBe("running");
  });

  it("refocuses the active tab when a tab changed the view", () => {
    const { result } = renderHook(() => useOverviewActivityView());
    const viewSwitcher = buildViewSwitcher();

    focusElementWithRole("tab");
    act(() => {
      result.current.changeView("failed");
    });
    result.current.viewSwitcherRef(viewSwitcher);

    expect(result.current.view).toBe("failed");
    expect(document.activeElement).toHaveTextContent("Failed");
  });

  it("refocuses the view select when one of its options changed the view", () => {
    const { result } = renderHook(() => useOverviewActivityView());
    const viewSwitcher = buildViewSwitcher();

    focusElementWithRole("option");
    act(() => {
      result.current.changeView("upcoming");
    });
    result.current.viewSwitcherRef(viewSwitcher);

    expect(document.activeElement).toHaveAttribute("role", "combobox");
  });

  it("leaves focus alone when the view changed from outside the switcher", () => {
    const { result } = renderHook(() => useOverviewActivityView());
    const viewSwitcher = buildViewSwitcher();

    act(() => {
      result.current.changeView("failed");
    });
    result.current.viewSwitcherRef(viewSwitcher);

    expect(document.activeElement).toBe(document.body);
  });
});

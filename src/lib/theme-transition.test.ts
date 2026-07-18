import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getThemeTransitionSnapshot,
  runThemeTransition,
} from "./theme-transition";

const root = document.documentElement;

describe("global theme transition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    root.classList.remove(
      "reduce-motion",
      "theme-transitioning",
      "theme-transition-to-light",
      "theme-transition-to-dark",
      "theme-transition-swap",
    );
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("switches the full theme once under a single viewport transition", () => {
    const applyTheme = vi.fn();

    expect(runThemeTransition("light", applyTheme, { x: 42, y: 84 })).toBe(true);
    expect(getThemeTransitionSnapshot()).toEqual({
      isTransitioning: true,
      direction: "to-light",
    });
    expect(root).toHaveClass("theme-transitioning", "theme-transition-to-light");
    expect(root.style.getPropertyValue("--theme-transition-x")).toBe("42px");
    expect(applyTheme).not.toHaveBeenCalled();

    vi.advanceTimersByTime(230);
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(root).toHaveClass("theme-transition-swap");

    vi.advanceTimersByTime(450);
    expect(root).not.toHaveClass("theme-transitioning", "theme-transition-swap");
    expect(getThemeTransitionSnapshot()).toEqual({
      isTransitioning: false,
      direction: null,
    });
  });

  it("applies immediately when reduced motion is enabled", () => {
    root.classList.add("reduce-motion");
    const applyTheme = vi.fn();

    expect(runThemeTransition("dark", applyTheme)).toBe(true);
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveClass("theme-transitioning");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getThemeTransitionSnapshot,
  runThemeTransition,
} from "./theme-transition";

const root = document.documentElement;

const deferred = <Value,>() => {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const installViewTransition = () => {
  const ready = deferred<void>();
  const finished = deferred<void>();
  const updateCallbackDone = deferred<void>();
  const startViewTransition = vi.fn((update: ViewTransitionUpdateCallback) => {
    Promise.resolve(update()).then(updateCallbackDone.resolve, updateCallbackDone.reject);
    return {
      finished: finished.promise,
      ready: ready.promise,
      skipTransition: vi.fn(),
      types: new Set<string>(),
      updateCallbackDone: updateCallbackDone.promise,
    } as unknown as ViewTransition;
  });

  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: startViewTransition,
  });

  return { finished, ready, startViewTransition, updateCallbackDone };
};

describe("global theme transition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    root.classList.remove(
      "reduce-motion",
      "theme-transitioning",
      "theme-transition-to-light",
      "theme-transition-to-dark",
      "theme-transition-fallback",
    );
    delete root.dataset.themeTransitionPhase;
    root.style.removeProperty("--theme-transition-x");
    root.style.removeProperty("--theme-transition-y");
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
  });

  it("switches the full theme once under one native viewport transition", async () => {
    const native = installViewTransition();
    const applyTheme = vi.fn();

    expect(runThemeTransition("light", applyTheme, { x: 42, y: 84 })).toBe(true);
    expect(native.startViewTransition).toHaveBeenCalledTimes(1);
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(root).toHaveClass("theme-transitioning", "theme-transition-to-light");
    expect(root.style.getPropertyValue("--theme-transition-x")).toBe("42px");
    expect(root.style.getPropertyValue("--theme-transition-y")).toBe("84px");
    expect(getThemeTransitionSnapshot()).toEqual({
      isTransitioning: true,
      direction: "to-light",
      phase: "switching",
    });

    native.ready.resolve();
    await native.ready.promise;
    expect(getThemeTransitionSnapshot().phase).toBe("settling");

    native.finished.resolve();
    await native.finished.promise;
    expect(root).not.toHaveClass("theme-transitioning");
    expect(getThemeTransitionSnapshot()).toEqual({
      isTransitioning: false,
      direction: null,
      phase: "idle",
    });
  });

  it("uses a restrained timed fallback when the native API is unavailable", () => {
    const applyTheme = vi.fn();

    expect(runThemeTransition("dark", applyTheme, { clientX: 18, clientY: 26 })).toBe(true);
    expect(root).toHaveClass(
      "theme-transitioning",
      "theme-transition-to-dark",
      "theme-transition-fallback",
    );
    expect(getThemeTransitionSnapshot().phase).toBe("preparing");
    expect(applyTheme).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(getThemeTransitionSnapshot().phase).toBe("switching");

    vi.advanceTimersByTime(16);
    expect(getThemeTransitionSnapshot().phase).toBe("settling");

    vi.advanceTimersByTime(224);
    expect(root).not.toHaveClass("theme-transitioning", "theme-transition-fallback");
    expect(getThemeTransitionSnapshot().phase).toBe("idle");
  });

  it("blocks a concurrent request without applying a second theme", () => {
    const firstApply = vi.fn();
    const secondApply = vi.fn();

    expect(runThemeTransition("light", firstApply)).toBe(true);
    expect(runThemeTransition("dark", secondApply)).toBe(false);

    vi.runAllTimers();
    expect(firstApply).toHaveBeenCalledTimes(1);
    expect(secondApply).not.toHaveBeenCalled();
  });

  it("cleans up when the native transition rejects", async () => {
    const native = installViewTransition();
    const applyTheme = vi.fn();

    expect(runThemeTransition("dark", applyTheme)).toBe(true);
    native.finished.reject(new Error("transition skipped"));
    await native.finished.promise.catch(() => undefined);

    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveClass("theme-transitioning");
    expect(getThemeTransitionSnapshot().phase).toBe("idle");
  });

  it("falls back if the native transition cannot start", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("not available");
      }),
    });
    const applyTheme = vi.fn();

    expect(runThemeTransition("light", applyTheme)).toBe(true);
    expect(root).toHaveClass("theme-transition-fallback");
    vi.runAllTimers();
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(getThemeTransitionSnapshot().phase).toBe("idle");
  });

  it("applies immediately when reduced motion is enabled", () => {
    root.classList.add("reduce-motion");
    const applyTheme = vi.fn();

    expect(runThemeTransition("dark", applyTheme)).toBe(true);
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveClass("theme-transitioning");
    expect(getThemeTransitionSnapshot().phase).toBe("idle");
  });
});

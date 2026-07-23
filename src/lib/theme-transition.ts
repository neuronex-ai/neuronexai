export type ThemeTransitionDirection = "to-light" | "to-dark";
export type ThemeTransitionPhase = "idle" | "preparing" | "switching" | "settling";

export type ThemeTransitionOrigin =
  | { x: number; y: number }
  | { clientX: number; clientY: number }
  | null
  | undefined;

type ThemeTransitionSnapshot = {
  isTransitioning: boolean;
  direction: ThemeTransitionDirection | null;
  phase: ThemeTransitionPhase;
};

const IDLE_SNAPSHOT: ThemeTransitionSnapshot = {
  isTransitioning: false,
  direction: null,
  phase: "idle",
};

let snapshot = IDLE_SNAPSHOT;
const listeners = new Set<() => void>();
const FALLBACK_SWAP_DELAY_MS = 120;
const FALLBACK_DURATION_MS = 360;

const publish = (next: ThemeTransitionSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const subscribeToThemeTransition = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getThemeTransitionSnapshot = () => snapshot;
export const getThemeTransitionServerSnapshot = () => IDLE_SNAPSHOT;

const resolveOrigin = (origin: ThemeTransitionOrigin) => {
  if (origin && "clientX" in origin && "clientY" in origin) {
    return { x: origin.clientX, y: origin.clientY };
  }
  if (origin && "x" in origin && "y" in origin) return origin;
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
};

const prepareRoot = (
  root: HTMLElement,
  direction: ThemeTransitionDirection,
  point: { x: number; y: number },
) => {
  root.style.setProperty("--theme-transition-x", `${point.x}px`);
  root.style.setProperty("--theme-transition-y", `${point.y}px`);
  root.classList.remove(
    "theme-transition-to-light",
    "theme-transition-to-dark",
    "theme-transition-fallback",
  );
  root.classList.add("theme-transitioning", `theme-transition-${direction}`);
  root.dataset.themeTransitionPhase = "preparing";
};

const setPhase = (
  root: HTMLElement,
  direction: ThemeTransitionDirection,
  phase: Exclude<ThemeTransitionPhase, "idle">,
) => {
  root.dataset.themeTransitionPhase = phase;
  publish({ isTransitioning: true, direction, phase });
};

const cleanupRoot = (root: HTMLElement) => {
  root.classList.remove(
    "theme-transitioning",
    "theme-transition-to-light",
    "theme-transition-to-dark",
    "theme-transition-fallback",
  );
  delete root.dataset.themeTransitionPhase;
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  publish(IDLE_SNAPSHOT);
};

export const runThemeTransition = (
  target: "light" | "dark",
  applyTheme: () => void,
  origin?: ThemeTransitionOrigin,
) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    applyTheme();
    return true;
  }

  if (snapshot.isTransitioning) return false;

  const root = document.documentElement;
  const reduceMotion =
    root.classList.contains("reduce-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    applyTheme();
    return true;
  }

  const direction: ThemeTransitionDirection = target === "light" ? "to-light" : "to-dark";
  const point = resolveOrigin(origin);
  let applied = false;
  let cleanedUp = false;

  const applyOnce = () => {
    if (applied) return;
    applied = true;
    setPhase(root, direction, "switching");
    applyTheme();
  };

  const cleanupOnce = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanupRoot(root);
  };

  prepareRoot(root, direction, point);
  publish({ isTransitioning: true, direction, phase: "preparing" });

  if (typeof document.startViewTransition === "function") {
    try {
      const transition = document.startViewTransition(() => {
        applyOnce();
      });

      void transition.ready.then(
        () => setPhase(root, direction, "settling"),
        () => undefined,
      );
      void transition.finished.then(cleanupOnce, cleanupOnce);
      return true;
    } catch {
      // Fall through to the restrained crossfade when the native API cannot start.
    }
  }

  root.classList.add("theme-transition-fallback");
  window.setTimeout(() => {
    applyOnce();
    window.setTimeout(() => setPhase(root, direction, "settling"), 16);
  }, FALLBACK_SWAP_DELAY_MS);
  window.setTimeout(cleanupOnce, FALLBACK_DURATION_MS);

  return true;
};

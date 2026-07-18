export type ThemeTransitionDirection = "to-light" | "to-dark";

export type ThemeTransitionOrigin =
  | { x: number; y: number }
  | { clientX: number; clientY: number }
  | null
  | undefined;

type ThemeTransitionSnapshot = {
  isTransitioning: boolean;
  direction: ThemeTransitionDirection | null;
};

const IDLE_SNAPSHOT: ThemeTransitionSnapshot = {
  isTransitioning: false,
  direction: null,
};

let snapshot = IDLE_SNAPSHOT;
const listeners = new Set<() => void>();

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

  root.style.setProperty("--theme-transition-x", `${point.x}px`);
  root.style.setProperty("--theme-transition-y", `${point.y}px`);
  root.classList.remove("theme-transition-to-light", "theme-transition-to-dark", "theme-transition-swap");
  root.classList.add("theme-transitioning", `theme-transition-${direction}`);
  publish({ isTransitioning: true, direction });

  window.setTimeout(() => {
    root.classList.add("theme-transition-swap");
    applyTheme();
    window.setTimeout(() => root.classList.remove("theme-transition-swap"), 72);
  }, 230);

  window.setTimeout(() => {
    root.classList.remove(
      "theme-transitioning",
      "theme-transition-to-light",
      "theme-transition-to-dark",
      "theme-transition-swap",
    );
    root.style.removeProperty("--theme-transition-x");
    root.style.removeProperty("--theme-transition-y");
    publish(IDLE_SNAPSHOT);
  }, 680);

  return true;
};

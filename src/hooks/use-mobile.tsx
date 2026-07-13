import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Synchronously detect if the current device is mobile.
 * Safe for SSR (returns false if window is not available).
 */
export function getIsMobileSync(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Returns the device type: 'mobile', 'tablet', or 'desktop'.
 * Uses User-Agent for initial detection + viewport width as fallback.
 */
export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent || "";
  const isMobileUA = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Android(?!.*Mobile)|tablet/i.test(ua);

  if (isMobileUA) return "mobile";
  if (isTabletUA) return "tablet";

  // Fallback to viewport width
  if (window.innerWidth < MOBILE_BREAKPOINT) return "mobile";
  return "desktop";
}

/**
 * Hook that returns true if the current device is a mobile phone.
 * Uses synchronous initialization to prevent layout flash.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => getIsMobileSync());

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Sync on mount in case SSR value was wrong
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

/**
 * Hook that returns the full device type ('mobile' | 'tablet' | 'desktop').
 * Desktop and tablet both get the desktop layout.
 */
export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<"mobile" | "tablet" | "desktop">(() => getDeviceType());

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setDeviceType(getDeviceType());
    };
    mql.addEventListener("change", onChange);
    setDeviceType(getDeviceType());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return deviceType;
}

import { afterEach, describe, expect, it } from "vitest";

import {
  beginThemePreferenceChange,
  finishThemePreferenceChange,
  getPendingThemePreference,
  shouldApplyPersistedTheme,
} from "./theme-preference-coordinator";

describe("theme preference coordinator", () => {
  afterEach(() => finishThemePreferenceChange());

  it("prevents stale consumers from restoring the previous theme", () => {
    beginThemePreferenceChange("light", true);

    expect(shouldApplyPersistedTheme("light", "dark")).toBe(false);
    expect(shouldApplyPersistedTheme("light", "dark")).toBe(false);
    expect(getPendingThemePreference()).toBe("light");
  });

  it("releases the shared pending preference after the optimistic cache catches up", () => {
    beginThemePreferenceChange("light", true);

    expect(shouldApplyPersistedTheme("dark", "light")).toBe(true);
    expect(getPendingThemePreference()).toBeNull();
  });

  it("does not retain a pending preference for unauthenticated consumers", () => {
    beginThemePreferenceChange("system", false);

    expect(getPendingThemePreference()).toBeNull();
  });

  it("clears only the matching failed preference", () => {
    beginThemePreferenceChange("dark", true);

    finishThemePreferenceChange("light");
    expect(getPendingThemePreference()).toBe("dark");

    finishThemePreferenceChange("dark");
    expect(getPendingThemePreference()).toBeNull();
  });
});

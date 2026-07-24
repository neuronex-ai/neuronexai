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
    beginThemePreferenceChange("light", "user-a");

    expect(shouldApplyPersistedTheme("light", "dark", "user-a")).toBe(false);
    expect(shouldApplyPersistedTheme("light", "dark", "user-a")).toBe(false);
    expect(getPendingThemePreference()).toBe("light");
  });

  it("releases the shared pending preference after the optimistic cache catches up", () => {
    beginThemePreferenceChange("light", "user-a");

    expect(shouldApplyPersistedTheme("dark", "light", "user-a")).toBe(true);
    expect(getPendingThemePreference()).toBeNull();
  });

  it("does not retain a pending preference for unauthenticated consumers", () => {
    beginThemePreferenceChange("system", null);

    expect(getPendingThemePreference()).toBeNull();
  });

  it("clears only the matching failed preference", () => {
    beginThemePreferenceChange("dark", "user-a");

    finishThemePreferenceChange("light");
    expect(getPendingThemePreference()).toBe("dark");

    finishThemePreferenceChange("dark");
    expect(getPendingThemePreference()).toBeNull();
  });

  it("never lets one account's pending write block another account", () => {
    beginThemePreferenceChange("light", "user-a");

    expect(shouldApplyPersistedTheme("light", "dark", "user-b")).toBe(true);
    expect(getPendingThemePreference()).toBe("light");

    finishThemePreferenceChange("light", "user-a");
    expect(getPendingThemePreference()).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  claimDesktopWelcomeForEntry,
  DESKTOP_WELCOME_TEMPLATES,
  getDailyDesktopWelcomeMessage,
  getDesktopWelcomeStorageKey,
  queueDesktopWelcomeForLogin,
} from "@/lib/desktop-session-welcome";

const createSessionStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("desktop session welcome", () => {
  it("provides twenty distinct templates matching the exported welcome artwork", () => {
    expect(DESKTOP_WELCOME_TEMPLATES).toHaveLength(20);
    expect(new Set(DESKTOP_WELCOME_TEMPLATES).size).toBe(20);
    expect(DESKTOP_WELCOME_TEMPLATES.filter((template) => template.includes("{name}"))).toHaveLength(2);
  });

  it("keeps the daily artwork selection stable", () => {
    const input = {
      userId: "professional-1",
      firstName: "Nathalia",
      date: new Date("2026-08-25T09:00:00.000-03:00"),
    };

    expect(getDailyDesktopWelcomeMessage(input)).toBe(getDailyDesktopWelcomeMessage(input));
    expect(getDailyDesktopWelcomeMessage(input)).toBeTruthy();
  });

  it("scopes the seen marker to the authenticated account", () => {
    expect(getDesktopWelcomeStorageKey("professional-1")).not.toBe(
      getDesktopWelcomeStorageKey("professional-2"),
    );
  });

  it("presents exactly once for each explicit login entry", () => {
    const storage = createSessionStorage();
    const firstLoginEntry = queueDesktopWelcomeForLogin("professional-1", storage);

    expect(claimDesktopWelcomeForEntry("professional-1", storage)).toBe(firstLoginEntry);
    expect(claimDesktopWelcomeForEntry("professional-1", storage)).toBeNull();

    const nextLoginEntry = queueDesktopWelcomeForLogin("professional-1", storage);
    expect(nextLoginEntry).not.toBe(firstLoginEntry);
    expect(claimDesktopWelcomeForEntry("professional-1", storage)).toBe(nextLoginEntry);
  });

  it("does not show a welcome for a restored session without a new login", () => {
    const storage = createSessionStorage();

    expect(claimDesktopWelcomeForEntry("professional-1", storage)).toBeNull();
    expect(claimDesktopWelcomeForEntry("professional-1", storage)).toBeNull();
  });
});

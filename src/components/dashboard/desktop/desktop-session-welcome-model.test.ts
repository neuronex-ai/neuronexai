import { describe, expect, it } from "vitest";

import {
  DESKTOP_WELCOME_TEMPLATES,
  getDailyDesktopWelcomeMessage,
  getDesktopWelcomeStorageKey,
} from "@/lib/desktop-session-welcome";

describe("desktop session welcome", () => {
  it("provides twenty distinct templates and every one includes the name token", () => {
    expect(DESKTOP_WELCOME_TEMPLATES).toHaveLength(20);
    expect(new Set(DESKTOP_WELCOME_TEMPLATES).size).toBe(20);
    expect(DESKTOP_WELCOME_TEMPLATES.every((template) => template.includes("{name}"))).toBe(true);
  });

  it("keeps the daily greeting stable and personalized", () => {
    const input = {
      userId: "professional-1",
      firstName: "Nathalia",
      date: new Date("2026-08-25T09:00:00.000-03:00"),
    };

    expect(getDailyDesktopWelcomeMessage(input)).toBe(getDailyDesktopWelcomeMessage(input));
    expect(getDailyDesktopWelcomeMessage(input)).toContain("Nathalia");
  });

  it("scopes the seen marker to the authenticated account", () => {
    expect(getDesktopWelcomeStorageKey("professional-1")).not.toBe(
      getDesktopWelcomeStorageKey("professional-2"),
    );
  });
});

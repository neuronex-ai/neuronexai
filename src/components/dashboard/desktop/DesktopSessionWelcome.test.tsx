import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDailyDesktopWelcomeIndex,
  getDailyDesktopWelcomeMessage,
  queueDesktopWelcomeForLogin,
} from "@/lib/desktop-session-welcome";

import { DesktopSessionWelcome } from "./DesktopSessionWelcome";
import { DESKTOP_WELCOME_ARTWORK } from "./desktop-session-welcome-artwork";

vi.mock("@/components/auth/SessionContextProvider", () => ({
  useAuth: () => ({
    user: {
      id: "professional-1",
      email: "nathalia@example.com",
      app_metadata: {},
      user_metadata: { first_name: "Nathalia" },
    },
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { first_name: "Nathalia" } }),
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: () => true };
});

describe("DesktopSessionWelcome", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("renders as a portal after a successful desktop login", async () => {
    queueDesktopWelcomeForLogin("professional-1");

    render(<DesktopSessionWelcome />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-neuronex-desktop-login-welcome");
    expect(dialog.parentElement).toBe(document.body);
    const expectedIndex = getDailyDesktopWelcomeIndex({ userId: "professional-1" });
    const expectedMessage = getDailyDesktopWelcomeMessage({
      userId: "professional-1",
      firstName: "Nathalia",
    });

    expect(dialog).toHaveTextContent(expectedMessage);
    expect(dialog.querySelector("img")).toHaveAttribute("src", DESKTOP_WELCOME_ARTWORK[expectedIndex]);
  });

  it("does not render for a restored session without a new login", async () => {
    render(<DesktopSessionWelcome />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

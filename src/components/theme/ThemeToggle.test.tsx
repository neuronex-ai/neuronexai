import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./ThemeToggle";

const mocks = vi.hoisted(() => ({
  isLight: false,
  isTransitioning: false,
  toggleTheme: vi.fn(),
}));

vi.mock("@/hooks/useThemeTransition", () => ({
  useThemeTransition: () => ({
    isLight: mocks.isLight,
    isTransitioning: mocks.isTransitioning,
    toggleTheme: mocks.toggleTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mocks.isLight = false;
    mocks.isTransitioning = false;
    mocks.toggleTheme.mockReset();
  });

  it("forwards the real click origin to the shared transition", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Ativar modo claro" });

    fireEvent.click(button, { clientX: 32, clientY: 48 });

    expect(mocks.toggleTheme).toHaveBeenCalledTimes(1);
    expect(mocks.toggleTheme.mock.calls[0]?.[0]).toMatchObject({
      clientX: 32,
      clientY: 48,
    });
  });

  it("keeps focus and exposes a busy state while a transition is active", () => {
    mocks.isTransitioning = true;
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Ativar modo claro" });

    button.focus();
    fireEvent.click(button);

    expect(button).toHaveFocus();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(mocks.toggleTheme).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Navbar } from "./Navbar";

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadNotificationCount: () => ({ unreadCount: 0 }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { first_name: "Ana", last_name: "Silva" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    theme: "dark",
    toggleTheme: vi.fn(),
    isTransitioning: false,
  }),
}));
vi.mock("@/components/auth/SessionContextProvider", () => ({
  useAuth: () => ({ user: { email: "ana@example.com" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));
vi.mock("@/components/dashboard/AlertsPanel", () => ({
  AlertsPanel: () => null,
}));
vi.mock("./CommandSearch", () => ({
  CommandSearch: () => null,
}));
vi.mock("@/components/subscription", () => ({
  TrialStatusIndicator: () => null,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

describe("professional desktop Navbar", () => {
  it("keeps its shell still and moves one shared active indicator between routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const shell = document.querySelector("#navbar-container > div");
    expect(shell).not.toHaveClass("hover:-translate-y-0.5");
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    expect(document.querySelectorAll("[data-desktop-nav-indicator='true']")).toHaveLength(1);

    fireEvent.click(screen.getByRole("link", { name: "Agenda" }));

    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Painel" })).not.toHaveAttribute("aria-current");
    expect(document.querySelectorAll("[data-desktop-nav-indicator='true']")).toHaveLength(1);
  });
});

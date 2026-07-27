import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Navbar } from "./Navbar";

vi.mock("@/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Alternar tema</button>,
}));

vi.mock("@/components/ui/Logo", () => ({
  Logo: () => <span aria-hidden="true">N</span>,
}));

describe("public desktop Navbar", () => {
  it("keeps the Products disclosure available by hover, click, and keyboard dismissal", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: /produtos/i });
    const disclosure = trigger.parentElement;

    expect(disclosure).not.toBeNull();

    fireEvent.mouseEnter(disclosure!);
    expect(screen.getByRole("group", { name: "Produtos NeuroNex" })).toBeInTheDocument();

    fireEvent.mouseLeave(disclosure!);
    await waitFor(() => {
      expect(screen.queryByRole("group", { name: "Produtos NeuroNex" })).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);
    expect(screen.getByRole("group", { name: "Produtos NeuroNex" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("group", { name: "Produtos NeuroNex" })).not.toBeInTheDocument();
    });
  });
});

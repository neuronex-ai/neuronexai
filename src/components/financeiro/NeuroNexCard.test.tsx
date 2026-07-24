import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NeuroNexCard } from "./NeuroNexCard";

const reducedMotion = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-reduced-motion-preference", () => ({
  useReducedMotionPreference: () => reducedMotion.value,
}));

describe("NeuroNexCard", () => {
  beforeEach(() => {
    reducedMotion.value = false;
  });

  it("keeps the expanded detail card legible against each inverse theme material", () => {
    render(
      <NeuroNexCard
        name="Joana Gasperi"
        bankName="Banco 260"
        agency="0001"
        account="•••• 9432"
        accountType="Conta corrente"
        isExpanded
      />,
    );

    expect(screen.getByText("CONTA CADASTRADA")).toHaveClass(
      "text-white/65",
      "dark:text-zinc-500",
    );
    expect(screen.getByText("Agência").nextElementSibling).toHaveClass(
      "text-white/90",
      "dark:text-zinc-800",
    );
    expect(screen.getByText("Tipo").nextElementSibling).toHaveClass(
      "text-white/80",
      "dark:text-zinc-700",
    );
  });

  it("exposes expansion semantics and supports Enter and Space only when interactive", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <NeuroNexCard name="Joana Gasperi" onToggle={onToggle} />,
    );

    const card = screen.getByRole("button", {
      name: "Expandir detalhes do cartão NeuroFinance",
    });
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(2);

    rerender(
      <NeuroNexCard name="Joana Gasperi" isExpanded onToggle={onToggle} />,
    );
    expect(
      screen.getByRole("button", { name: "Recolher detalhes do cartão NeuroFinance" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("stays non-interactive without onToggle, including in the PayWizard use case", () => {
    const { container } = render(<NeuroNexCard name="Joana Gasperi" />);
    const card = screen.getByText("Joana Gasperi").closest("[class*='group/card']");

    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
    expect(card).not.toHaveAttribute("aria-expanded");
    expect(card).not.toHaveAttribute("aria-label");
    expect(container.querySelector('[role="button"]')).not.toBeInTheDocument();
  });

  it("removes hover animation and animated layer transitions for reduced motion", () => {
    reducedMotion.value = true;
    const { container } = render(
      <NeuroNexCard name="Joana Gasperi" onToggle={vi.fn()} />,
    );

    const shine = container.querySelector('[data-card-shine="true"]');
    expect(shine).toHaveClass("transition-none");
    expect(shine).not.toHaveClass("group-hover/card:opacity-100");
    expect(container.querySelectorAll(".transition-none")).toHaveLength(3);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NeuroNexCard } from "./NeuroNexCard";

describe("NeuroNexCard", () => {
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
});

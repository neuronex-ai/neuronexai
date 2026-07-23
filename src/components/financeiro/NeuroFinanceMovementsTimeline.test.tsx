import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NeuroFinanceMovementsTimeline } from "./NeuroFinanceMovementsTimeline";

vi.mock("@/hooks/use-bill-payments-calendar", () => ({
  useBillPaymentsCalendar: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-neurofinance-balance-details", () => ({
  useNeuroFinanceBalanceDetails: () => ({ data: [], isLoading: false }),
}));

describe("NeuroFinanceMovementsTimeline", () => {
  it("uses a clean text header without the redundant bank icon control", () => {
    const { container } = render(
      <NeuroFinanceMovementsTimeline
        onOpenFutureStatement={vi.fn()}
        onOpenScheduledPayments={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Próximos movimentos da conta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extrato futuro/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pagamentos agendados/i })).toBeInTheDocument();
    expect(container.querySelector('[data-lucide="landmark"]')).not.toBeInTheDocument();
  });
});

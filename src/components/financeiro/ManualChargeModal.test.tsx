import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManualChargeModal } from "./ManualChargeModal";

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  transitionEntry: vi.fn(),
  generateInvoice: vi.fn(),
  consumePackage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/hooks/use-patients", () => ({
  usePatients: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-patient-insurance-agreements", () => ({
  formatCentsAsBRL: (value: number) => String(value),
  usePatientInsuranceAgreements: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-patient-record-details", () => ({
  usePatientRecordDetails: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/hooks/use-active-patient-packages", () => ({
  useActivePatientPackages: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-appointments", () => ({
  useAppointments: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-financial-account", () => ({
  useFinancialAccount: () => ({ isApproved: false, account: null }),
}));

vi.mock("@/hooks/use-generate-invoice", () => ({
  useGenerateInvoice: () => ({ mutateAsync: mocks.generateInvoice, isPending: false }),
}));

vi.mock("@/hooks/use-use-package-session", () => ({
  useUsePackageSession: () => ({ mutateAsync: mocks.consumePackage, isPending: false }),
}));

vi.mock("@/hooks/use-financial-entries", () => ({
  buildFinancialEntryIdempotencyKey: (parts: unknown[]) => parts.join(":"),
  useCreateFinancialEntry: () => ({ mutateAsync: mocks.createEntry, isPending: false }),
  useTransitionFinancialEntry: () => ({ mutateAsync: mocks.transitionEntry, isPending: false }),
}));

describe("ManualChargeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createEntry.mockResolvedValue({ id: "entry-1" });
  });

  it("creates an open manual charge and closes with a success state", async () => {
    const onOpenChange = vi.fn();
    render(<ManualChargeModal open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "125,50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));

    await waitFor(() => expect(mocks.createEntry).toHaveBeenCalledTimes(1));
    expect(mocks.createEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: "income",
      title: "Cobrança manual",
      amount: 125.5,
      status: "pending",
      paymentMethod: "manual",
      origin: "manual",
      metadata: expect.objectContaining({
        source: "manual_charge_modal",
        intended_destination: "management",
      }),
    }));
    expect(mocks.transitionEntry).not.toHaveBeenCalled();
    expect(mocks.generateInvoice).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Cobrança criada em aberto.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

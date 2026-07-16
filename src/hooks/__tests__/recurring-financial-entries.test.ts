import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  recurringFinancialEntryAllowedStatusesForAction,
  recurringFinancialEntryScopeOf,
  recurringFinancialEntryStatusForAction,
  validateRecurringFinancialEntryInput,
  type NewRecurringFinancialEntryInput,
} from "../use-financial-entries";

const validInput = (overrides: Partial<NewRecurringFinancialEntryInput> = {}): NewRecurringFinancialEntryInput => ({
  type: "income",
  title: "Mensalidade clínica",
  amount: 500,
  frequency: "monthly",
  startDate: new Date("2026-07-16T12:00:00"),
  endDate: null,
  scope: "clinic",
  ...overrides,
});

describe("recorrências financeiras estruturadas", () => {
  it("valida valor, título e intervalo antes de gravar", () => {
    expect(validateRecurringFinancialEntryInput(validInput())).toBeNull();
    expect(validateRecurringFinancialEntryInput(validInput({ title: "  " }))).toBe(
      "Informe um título para a recorrência.",
    );
    expect(validateRecurringFinancialEntryInput(validInput({ amount: 0 }))).toBe(
      "Informe um valor maior que zero.",
    );
    expect(
      validateRecurringFinancialEntryInput(
        validInput({ endDate: new Date("2026-07-15T12:00:00") }),
      ),
    ).toBe("A data final não pode ser anterior à data inicial.");
  });

  it("converte ações somente para estados permitidos e mantém repetição idempotente", () => {
    expect(recurringFinancialEntryStatusForAction("pause")).toBe("paused");
    expect(recurringFinancialEntryAllowedStatusesForAction("pause")).toEqual(["active", "paused"]);
    expect(recurringFinancialEntryStatusForAction("resume")).toBe("active");
    expect(recurringFinancialEntryAllowedStatusesForAction("resume")).toEqual(["paused", "active"]);
    expect(recurringFinancialEntryStatusForAction("finish")).toBe("finished");
    expect(recurringFinancialEntryAllowedStatusesForAction("finish")).toEqual([
      "active",
      "paused",
      "finished",
    ]);
  });

  it("separa o escopo pessoal e trata registros antigos como pertencentes à clínica", () => {
    expect(recurringFinancialEntryScopeOf({ metadata: { scope: "personal" } })).toBe("personal");
    expect(recurringFinancialEntryScopeOf({ metadata: { scope: "clinic" } })).toBe("clinic");
    expect(recurringFinancialEntryScopeOf({ metadata: null })).toBe("clinic");
  });

  it("mantém atualizações vinculadas ao registro e ao profissional, sem exclusão física", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-financial-entries.ts"), "utf8");
    const updateContract = source.slice(
      source.indexOf("export async function updateRecurringFinancialEntryStatus"),
      source.indexOf("function serializeFinancialEntryPatch"),
    );

    expect(updateContract).toContain(".eq('id', input.id)");
    expect(updateContract).toContain(".eq('professional_id', professionalId)");
    expect(updateContract).toContain(".in('status', allowedStatuses)");
    expect(updateContract).not.toContain(".delete(");
  });
});

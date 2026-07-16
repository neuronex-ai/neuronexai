import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceOf = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("statement print modal theme contract", () => {
  it("uses semantic surface colors in light and dark mode", () => {
    const modal = sourceOf(
      "src/components/financeiro/statement/StatementPrintModal.tsx",
    );

    expect(modal).toContain("bg-background/96");
    expect(modal).toContain("text-foreground");
    expect(modal).toContain("border-border/45");
    expect(modal).toContain("dark:bg-black/35");
    expect(modal).toContain("motion-reduce:transition-none");
    expect(modal).not.toContain("bg-[#0A0A0B]");
    expect(modal).not.toContain("border-white/10");
  });

  it("keeps the printable document language correctly accented", () => {
    const template = sourceOf(
      "src/components/financeiro/statement/FinancialStatementTemplate.tsx",
    );

    expect(template).toContain("Relatório financeiro");
    expect(template).toContain("Período completo");
    expect(template).toContain("Descrição");
    expect(template).toContain("Saídas");
  });
});

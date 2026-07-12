import { describe, expect, it } from "vitest";
import {
  formatBrazilianPhone,
  isValidBrazilianPhone,
} from "./brazilian-phone";

describe("formatação de telefone em Ajustes", () => {
  it("mantém o código do Brasil fora da máscara e aceita celular com nono dígito", () => {
    expect(formatBrazilianPhone("+55 48 98872-4548")).toBe("(48) 98872-4548");
    expect(isValidBrazilianPhone("+55 48 98872-4548")).toBe(true);
  });

  it("aceita telefone com oito dígitos depois do DDD", () => {
    expect(formatBrazilianPhone("48 8872-4548")).toBe("(48) 8872-4548");
    expect(isValidBrazilianPhone("48 8872-4548")).toBe(true);
  });

  it("rejeita números acima do limite em vez de salvá-los silenciosamente", () => {
    expect(isValidBrazilianPhone("+55 48 98872-4548 999999")).toBe(false);
  });

  it("rejeita celular de onze dígitos sem o nono dígito esperado", () => {
    expect(isValidBrazilianPhone("48 88872-4548")).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/landing/PublicFlowComparison.tsx"), "utf8");

describe("comparativo público da NeuroNex", () => {
  it("mantém a narrativa de rotina fragmentada para uma rotina coordenada", () => {
    expect(source).toContain("Hoje, você ainda precisa conectar tudo sozinho.");
    expect(source).toContain("Com a NeuroNex, tudo passa a trabalhar junto.");
    expect(source).toContain('connected ? "Synapse" : "Você"');
    expect(source).toContain("A NeuroNex vira o painel de trabalho do Synapse.");
  });

  it("oferece cenários reais com estrutura acessível", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain("Novo agendamento");
    expect(source).toContain("Reagendamento");
    expect(source).toContain("Teleconsulta");
    expect(source).toContain("Cobrança");
    expect(source).toContain("Mensagem de paciente");
  });

  it("respeita a preferência de redução de movimento", () => {
    expect(source).toContain('MotionConfig reducedMotion="user"');
    expect(source).toContain("useReducedMotion()");
    expect(source).toContain("MobileFlow");
  });
});

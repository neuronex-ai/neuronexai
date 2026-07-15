import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const comparisonSource = readFileSync(resolve(process.cwd(), "src/components/landing/PublicFlowComparison.tsx"), "utf8");
const heroVisualSource = readFileSync(resolve(process.cwd(), "src/components/landing/HeroVisual.tsx"), "utf8");
const synapseVoiceSource = readFileSync(resolve(process.cwd(), "src/components/landing/SynapseVoiceChapter.tsx"), "utf8");

describe("comparativo público da NeuroNex", () => {
  it("mantém o comparativo desktop em um único diagrama com seis núcleos", () => {
    expect(comparisonSource).toContain('label: "Agenda"');
    expect(comparisonSource).toContain('label: "WhatsApp"');
    expect(comparisonSource).toContain('label: "Prontuário"');
    expect(comparisonSource).toContain('label: "Teleconsulta"');
    expect(comparisonSource).toContain('label: "Financeiro"');
    expect(comparisonSource).toContain('label: "Fiscal"');
    expect(comparisonSource).not.toContain("Portal do Paciente");
  });

  it("calcula conexões a partir das posições reais e não de caminhos fixos", () => {
    expect(comparisonSource).toContain("ResizeObserver");
    expect(comparisonSource).toContain("getBoundingClientRect()");
    expect(comparisonSource).toContain("buildPath(element.getBoundingClientRect()");
  });

  it("oferece cenários reais com estrutura acessível", () => {
    expect(comparisonSource).toContain('role="tablist"');
    expect(comparisonSource).toContain('role="tab"');
    expect(comparisonSource).toContain('role="tabpanel"');
    expect(comparisonSource).toContain("Novo agendamento");
    expect(comparisonSource).toContain("Reagendamento");
    expect(comparisonSource).toContain("Teleconsulta");
    expect(comparisonSource).toContain("Cobrança");
    expect(comparisonSource).toContain("Mensagem de paciente");
  });
});

describe("cenas públicas com screenshots reais", () => {
  it("não usa imagens remotas nas apresentações novas", () => {
    expect(heroVisualSource).not.toMatch(/https?:\/\//);
    expect(synapseVoiceSource).not.toMatch(/https?:\/\//);
  });

  it("mantém a sequência de voz completa do Synapse em HTML rastreável", () => {
    expect(synapseVoiceSource).toContain("Synapse, abra o NeuroView da Mariana");
    expect(synapseVoiceSource).toContain("Notas › NeuroView");
    expect(synapseVoiceSource).toContain("Teleconsulta em 10 minutos");
    expect(synapseVoiceSource).toContain("Pill disponível para continuar");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/landing/PublicFlowComparison.tsx"), "utf8");

describe("comparativo público da NeuroNex", () => {
  it("mantém a narrativa de rotina fragmentada para uma rotina coordenada", () => {
    expect(source).toContain("Hoje, você ainda precisa conectar tudo sozinho.");
    expect(source).toContain("Com a NeuroNex, a rotina passa a trabalhar em conjunto.");
    expect(source).toContain('fragmented: "Ferramentas separadas"');
    expect(source).toContain('synapse: "O contexto encontra um núcleo"');
    expect(source).toContain('connected: "Uma rotina coordenada"');
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

  it("mantém a cena desktop compacta e ligada ao progresso real do scroll", () => {
    expect(source).toContain('lg:h-[360svh]');
    expect(source).toContain('sticky top-0 h-svh overflow-hidden');
    expect(source).toContain("useScroll({");
    expect(source).toContain("useTransform(");
    expect(source).toContain("useMotionValueEvent(scrollYProgress");
    expect(source).toContain("pathLength: manualLength");
    expect(source).toContain("pathLength: connectedLength");
  });

  it("mede conexões e limita a história a seis nós por variante", () => {
    expect(source).toContain("new ResizeObserver(measure)");
    expect(source).toContain("nodeRefs.current");
    expect(source).toContain("nodes: [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]");
  });

  it("respeita redução de movimento e oferece comparação estática compacta", () => {
    expect(source).toContain('MotionConfig reducedMotion="user"');
    expect(source).toContain("useReducedMotion()");
    expect(source).toContain("CompactComparison");
    expect(source).toContain('reduceMotion ? "lg:py-28"');
  });
});
